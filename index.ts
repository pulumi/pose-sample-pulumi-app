import * as gcp from "@pulumi/gcp";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

// Configuration
const config = new gcp.Config();
const projectId = gcp.config.project || "your-gcp-project";
const region = config.get("region") || "us-central1";
const zone = config.get("zone") || "us-central1-a";

// Random suffix for unique resource names
const suffix = new random.RandomString("suffix", {
    length: 8,
    special: false,
    upper: false,
});

// GKE Cluster for PyTorch Training
const cluster = new gcp.container.Cluster("pytorch-cluster", {
    name: suffix.result.apply(s => `pytorch-cluster-${s}`),
    location: region,
    
    // Remove default node pool - we'll create custom ones
    removeDefaultNodePool: true,
    initialNodeCount: 1,
    
    // Network configuration for security
    networkingMode: "VPC_NATIVE",
    ipAllocationPolicy: {
        clusterIpv4CidrBlock: "10.0.0.0/14",
        servicesIpv4CidrBlock: "10.4.0.0/19",
    },
    
    // Private cluster configuration
    privateClusterConfig: {
        enablePrivateNodes: true,
        enablePrivateEndpoint: false, // Allow public access for development
        masterIpv4CidrBlock: "10.5.0.0/28",
    },
    
    // Enable workload identity for secure pod-to-GCP authentication
    workloadIdentityConfig: {
        workloadPool: `${projectId}.svc.id.goog`,
    },
    
    // Cluster features
    addonsConfig: {
        horizontalPodAutoscaling: { disabled: false },
        httpLoadBalancing: { disabled: false },
        networkPolicyConfig: { disabled: false },
    },
    
    // Enable logging and monitoring
    loggingService: "logging.googleapis.com/kubernetes",
    monitoringService: "monitoring.googleapis.com/kubernetes",
    
    // Resource labels
    resourceLabels: {
        environment: "development",
        purpose: "pytorch-training",
        team: "ml-engineering",
    },
});

// System Node Pool (for Kubernetes system components)
const systemNodePool = new gcp.container.NodePool("system-pool", {
    name: "system-pool",
    cluster: cluster.name,
    location: region,
    
    nodeCount: 1,
    
    nodeConfig: {
        machineType: "e2-medium", // Cost-effective for system workloads
        diskSizeGb: 50,
        diskType: "pd-standard",
        
        // Use Container-Optimized OS
        imageType: "COS_CONTAINERD",
        
        // Security settings
        serviceAccount: "default",
        oauthScopes: [
            "https://www.googleapis.com/auth/cloud-platform",
        ],
        
        // Node labels and taints for system workloads
        labels: {
            "node-type": "system",
            "workload": "system",
        },
        
        taint: [{
            key: "node-type",
            value: "system",
            effect: "NO_SCHEDULE",
        }],
        
        metadata: {
            "disable-legacy-endpoints": "true",
        },
    },
    
    management: {
        autoRepair: true,
        autoUpgrade: true,
    },
});

// GPU Node Pool (for PyTorch training workloads)
const gpuNodePool = new gcp.container.NodePool("gpu-pool", {
    name: "gpu-pool",
    cluster: cluster.name,
    location: zone, // GPU nodes need to be in specific zones
    
    // Start with 0 nodes for cost savings, scale up when needed
    initialNodeCount: 0,
    
    autoscaling: {
        minNodeCount: 0,
        maxNodeCount: 3, // Limit for development environment
    },
    
    nodeConfig: {
        machineType: "n1-standard-4", // Good balance for T4 GPU
        diskSizeGb: 100,
        diskType: "pd-ssd", // SSD for better I/O performance
        
        // NVIDIA T4 GPU (cost-effective for development)
        guestAccelerator: [{
            type: "nvidia-tesla-t4",
            count: 1,
        }],
        
        // Use Container-Optimized OS with GPU support
        imageType: "COS_CONTAINERD",
        
        // Security settings
        serviceAccount: "default",
        oauthScopes: [
            "https://www.googleapis.com/auth/cloud-platform",
        ],
        
        // Node labels for GPU workloads
        labels: {
            "node-type": "gpu",
            "workload": "training",
            "accelerator": "nvidia-tesla-t4",
        },
        
        taint: [{
            key: "nvidia.com/gpu",
            value: "present",
            effect: "NO_SCHEDULE",
        }],
        
        metadata: {
            "disable-legacy-endpoints": "true",
        },
    },
    
    management: {
        autoRepair: true,
        autoUpgrade: true,
    },
});

// Kubernetes provider
const k8sProvider = new k8s.Provider("gke-k8s", {
    kubeconfig: cluster.name.apply(name => 
        gcp.container.getClusterKubeconfig({
            name: name,
            location: region,
        }).then(result => result.kubeconfig)
    ),
});

// Namespace for PyTorch training workloads
const trainingNamespace = new k8s.core.v1.Namespace("pytorch-training", {
    metadata: {
        name: "pytorch-training",
        labels: {
            purpose: "ml-training",
            environment: "development",
        },
    },
}, { provider: k8sProvider });

// Resource quota for cost control
const resourceQuota = new k8s.core.v1.ResourceQuota("training-quota", {
    metadata: {
        namespace: trainingNamespace.metadata.name,
        name: "training-resource-quota",
    },
    spec: {
        hard: {
            "requests.cpu": "8",
            "requests.memory": "32Gi",
            "requests.nvidia.com/gpu": "2",
            "limits.cpu": "16",
            "limits.memory": "64Gi",
            "limits.nvidia.com/gpu": "2",
            "persistentvolumeclaims": "5",
        },
    },
}, { provider: k8sProvider });

// NVIDIA device plugin for GPU support
const nvidiaDevicePlugin = new k8s.apps.v1.DaemonSet("nvidia-device-plugin", {
    metadata: {
        name: "nvidia-device-plugin-daemonset",
        namespace: "kube-system",
    },
    spec: {
        selector: {
            matchLabels: {
                name: "nvidia-device-plugin-ds",
            },
        },
        updateStrategy: {
            type: "RollingUpdate",
        },
        template: {
            metadata: {
                labels: {
                    name: "nvidia-device-plugin-ds",
                },
            },
            spec: {
                tolerations: [{
                    key: "nvidia.com/gpu",
                    operator: "Exists",
                    effect: "NoSchedule",
                }],
                nodeSelector: {
                    "accelerator": "nvidia-tesla-t4",
                },
                priorityClassName: "system-node-critical",
                containers: [{
                    image: "nvcr.io/nvidia/k8s-device-plugin:v0.14.1",
                    name: "nvidia-device-plugin-ctr",
                    args: ["--fail-on-init-error=false"],
                    securityContext: {
                        allowPrivilegeEscalation: false,
                        capabilities: {
                            drop: ["ALL"],
                        },
                    },
                    volumeMounts: [{
                        name: "device-plugin",
                        mountPath: "/var/lib/kubelet/device-plugins",
                    }],
                }],
                volumes: [{
                    name: "device-plugin",
                    hostPath: {
                        path: "/var/lib/kubelet/device-plugins",
                    },
                }],
            },
        },
    },
}, { provider: k8sProvider });

// Persistent Volume for datasets and model storage
const datasetPVC = new k8s.core.v1.PersistentVolumeClaim("pytorch-datasets", {
    metadata: {
        namespace: trainingNamespace.metadata.name,
        name: "pytorch-datasets",
    },
    spec: {
        accessModes: ["ReadWriteOnce"],
        resources: {
            requests: {
                storage: "100Gi",
            },
        },
        storageClassName: "standard-rwo",
    },
}, { provider: k8sProvider });

// Export important values
export const clusterName = cluster.name;
export const clusterEndpoint = cluster.endpoint;
export const clusterLocation = cluster.location;
export const kubeconfig = cluster.name.apply(name => 
    gcp.container.getClusterKubeconfig({
        name: name,
        location: region,
    }).then(result => result.kubeconfig)
);
export const trainingNamespaceName = trainingNamespace.metadata.name;