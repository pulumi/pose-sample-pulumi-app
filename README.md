# PyTorch Training Cluster on GKE

A canonical development PyTorch cluster built on Google Kubernetes Engine (GKE) with GPU support, designed for cost-effective development and ready for production-scale training.

## Architecture Overview

### Infrastructure Components

- **GKE Cluster**: Regional cluster with private nodes and workload identity
- **System Node Pool**: Cost-effective nodes (e2-medium) for Kubernetes system components
- **GPU Node Pool**: NVIDIA T4 GPU nodes (n1-standard-4) for training workloads
- **Networking**: VPC-native networking with private cluster configuration
- **Storage**: Persistent volumes for datasets, models, and checkpoints

### Cost Optimization Features

- **Development-focused**: Starts with 0 GPU nodes, scales up on demand
- **NVIDIA T4 GPUs**: Cost-effective GPU choice for development workloads
- **Autoscaling**: Automatic scaling based on workload demands
- **Resource Quotas**: Prevents runaway costs with defined limits

### Production-Ready Design

- **Scalable Architecture**: Easy transition to more powerful GPU types
- **Monitoring Integration**: Built-in monitoring and logging
- **CI/CD Pipeline**: Automated deployments via GitHub Actions
- **Security**: Private cluster with workload identity and proper RBAC

## Quick Start

### Prerequisites

1. Google Cloud Project with billing enabled
2. Required APIs enabled:
   - Kubernetes Engine API
   - Compute Engine API
   - Container Registry API
3. Service account with appropriate permissions
4. Pulumi account and access token

### Deployment

1. **Configure the project**:
   ```bash
   # Update Pulumi.dev.yaml with your GCP project ID
   pulumi config set gcp:project your-gcp-project-id
   pulumi config set gcp:region us-central1
   ```

2. **Deploy the infrastructure**:
   ```bash
   npm install
   pulumi up
   ```

3. **Get cluster credentials**:
   ```bash
   CLUSTER_NAME=$(pulumi stack output clusterName)
   CLUSTER_LOCATION=$(pulumi stack output clusterLocation)
   gcloud container clusters get-credentials $CLUSTER_NAME --location=$CLUSTER_LOCATION
   ```

4. **Deploy training resources**:
   ```bash
   kubectl apply -f pytorch-training/sample-training-job.yaml
   kubectl apply -f pytorch-training/monitoring.yaml
   ```

### Running Your First Training Job

```bash
# Check if GPU nodes are available
kubectl get nodes -l accelerator=nvidia-tesla-t4

# Run the sample training job
kubectl apply -f pytorch-training/sample-training-job.yaml

# Monitor the job
kubectl get jobs -n pytorch-training
kubectl logs job/pytorch-training-sample -n pytorch-training -f
```

## Development Workflow

### Local Development

1. **Test infrastructure changes**:
   ```bash
   pulumi preview
   ```

2. **Deploy changes**:
   ```bash
   pulumi up
   ```

3. **Run training experiments**:
   ```bash
   kubectl apply -f your-training-job.yaml
   ```

### CI/CD Pipeline

The GitHub Actions workflow automatically:
- Previews infrastructure changes on PRs
- Deploys to development environment on main branch pushes
- Runs integration tests with sample training jobs
- Supports manual deployments to staging/production

## Scaling for Production

### Automatic Scaling

The cluster includes a production scaling script:

```bash
./scripts/scale-cluster.sh \
  --cluster-name your-cluster-name \
  --location us-central1 \
  --max-nodes 20 \
  --machine-type n1-standard-8 \
  --gpu-type nvidia-tesla-v100
```

### Production Configuration

For production workloads, consider:

1. **Upgrade GPU types**: T4 → V100 → A100
2. **Increase node sizes**: n1-standard-4 → n1-standard-8+
3. **Add more storage**: Increase PVC sizes for larger datasets
4. **Enable monitoring**: Set up Prometheus and Grafana
5. **Configure alerts**: Set up cost and performance alerts

### Resource Templates

Use the production training template:

```bash
# Set environment variables
export MODEL_NAME="resnet50"
export EXPERIMENT_ID="exp-001"
export EPOCHS="100"
export BATCH_SIZE="64"

# Apply with substitutions
envsubst < pytorch-training/production-training-template.yaml | kubectl apply -f -
```

## Monitoring and Observability

### Cluster Monitoring

- **Google Cloud Monitoring**: Automatic cluster and node metrics
- **Kubernetes Dashboard**: Web UI for cluster management
- **Resource Usage**: Built-in resource quota monitoring

### Training Job Monitoring

- **Job Logs**: Centralized logging via Cloud Logging
- **Custom Metrics**: Prometheus integration for training metrics
- **GPU Utilization**: NVIDIA GPU metrics collection

### Cost Monitoring

- **Resource Quotas**: Prevent cost overruns
- **Billing Alerts**: Set up budget alerts in Google Cloud
- **Usage Reports**: Regular cost analysis and optimization

## Security Features

- **Private Cluster**: Nodes have no external IP addresses
- **Workload Identity**: Secure pod-to-GCP service authentication
- **Network Policies**: Kubernetes network segmentation
- **RBAC**: Role-based access control for training namespaces
- **Pod Security**: Security contexts and admission controllers

## Troubleshooting

### Common Issues

1. **GPU nodes not starting**:
   ```bash
   # Check node pool status
   kubectl describe nodes
   # Check GPU availability in your zone
   gcloud compute accelerator-types list --zones=us-central1-a
   ```

2. **Training jobs stuck in pending**:
   ```bash
   # Check resource requests vs. available resources
   kubectl describe pod -n pytorch-training
   # Check node selectors and tolerations
   ```

3. **Out of quota errors**:
   ```bash
   # Check current quotas
   gcloud compute project-info describe --project=your-project
   # Request quota increases if needed
   ```

### Getting Help

- Check the [Pulumi GCP documentation](https://www.pulumi.com/docs/clouds/gcp/)
- Review [GKE best practices](https://cloud.google.com/kubernetes-engine/docs/best-practices)
- Consult [PyTorch on Kubernetes guides](https://pytorch.org/tutorials/intermediate/kubernetes_tutorial.html)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `pulumi preview`
5. Submit a pull request

The CI/CD pipeline will automatically test your changes and provide feedback.

## License

This project is licensed under the MIT License - see the LICENSE file for details.