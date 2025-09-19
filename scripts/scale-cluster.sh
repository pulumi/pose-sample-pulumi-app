#!/bin/bash

# Script to scale the PyTorch training cluster for production workloads

set -e

CLUSTER_NAME=""
LOCATION=""
NODE_POOL="gpu-pool"
MIN_NODES=0
MAX_NODES=10
MACHINE_TYPE="n1-standard-8"
GPU_TYPE="nvidia-tesla-v100"
GPU_COUNT=1

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --cluster-name)
      CLUSTER_NAME="$2"
      shift 2
      ;;
    --location)
      LOCATION="$2"
      shift 2
      ;;
    --min-nodes)
      MIN_NODES="$2"
      shift 2
      ;;
    --max-nodes)
      MAX_NODES="$2"
      shift 2
      ;;
    --machine-type)
      MACHINE_TYPE="$2"
      shift 2
      ;;
    --gpu-type)
      GPU_TYPE="$2"
      shift 2
      ;;
    --gpu-count)
      GPU_COUNT="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 --cluster-name CLUSTER_NAME --location LOCATION [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --cluster-name    GKE cluster name (required)"
      echo "  --location        GKE cluster location (required)"
      echo "  --min-nodes       Minimum number of nodes (default: 0)"
      echo "  --max-nodes       Maximum number of nodes (default: 10)"
      echo "  --machine-type    Machine type for nodes (default: n1-standard-8)"
      echo "  --gpu-type        GPU type (default: nvidia-tesla-v100)"
      echo "  --gpu-count       Number of GPUs per node (default: 1)"
      echo "  --help            Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [[ -z "$CLUSTER_NAME" || -z "$LOCATION" ]]; then
  echo "Error: --cluster-name and --location are required"
  echo "Use --help for usage information"
  exit 1
fi

echo "Scaling cluster for production workloads..."
echo "Cluster: $CLUSTER_NAME"
echo "Location: $LOCATION"
echo "Node pool: $NODE_POOL"
echo "Min nodes: $MIN_NODES"
echo "Max nodes: $MAX_NODES"
echo "Machine type: $MACHINE_TYPE"
echo "GPU type: $GPU_TYPE"
echo "GPU count: $GPU_COUNT"

# Update node pool configuration
echo "Updating node pool autoscaling..."
gcloud container clusters resize $CLUSTER_NAME \
  --node-pool $NODE_POOL \
  --num-nodes $MIN_NODES \
  --location $LOCATION \
  --quiet

gcloud container node-pools update $NODE_POOL \
  --cluster $CLUSTER_NAME \
  --location $LOCATION \
  --enable-autoscaling \
  --min-nodes $MIN_NODES \
  --max-nodes $MAX_NODES

# Create a new production node pool if needed
PROD_NODE_POOL="gpu-prod-pool"
echo "Creating production node pool: $PROD_NODE_POOL"

gcloud container node-pools create $PROD_NODE_POOL \
  --cluster $CLUSTER_NAME \
  --location $LOCATION \
  --machine-type $MACHINE_TYPE \
  --accelerator type=$GPU_TYPE,count=$GPU_COUNT \
  --enable-autoscaling \
  --min-nodes 0 \
  --max-nodes $MAX_NODES \
  --disk-size 200GB \
  --disk-type pd-ssd \
  --image-type COS_CONTAINERD \
  --node-labels workload=production-training,accelerator=$GPU_TYPE \
  --node-taints nvidia.com/gpu=present:NoSchedule \
  --enable-autorepair \
  --enable-autoupgrade \
  --metadata disable-legacy-endpoints=true \
  --scopes cloud-platform

echo "Production scaling complete!"
echo ""
echo "Next steps:"
echo "1. Update your training jobs to use the production node pool"
echo "2. Set appropriate resource requests and limits"
echo "3. Monitor cluster costs and usage"
echo "4. Consider using preemptible instances for cost savings"