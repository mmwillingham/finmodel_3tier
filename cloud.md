# Prerequisites
# Create Google Cloud Project
<steps not shown>

# Install Google Cloud cli
sudo tee -a /etc/yum.repos.d/google-cloud-sdk.repo << EOM
[google-cloud-cli]
name=Google Cloud CLI
baseurl=https://packages.cloud.google.com/yum/repos/cloud-sdk-el9-x86_64
enabled=1
gpgcheck=1
repo_gpgcheck=0
gpgkey=https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
EOM

# Install libxcrypt-compat.x86_64.
sudo dnf install libxcrypt-compat.x86_64 -y

# Install the gcloud CLI:
sudo dnf install google-cloud-cli -y

# Optional packages that can be installed with sudo dnf install <package-name>
#google-cloud-cli-anthos-auth
#google-cloud-cli-app-engine-go
#google-cloud-cli-app-engine-grpc
#google-cloud-cli-app-engine-java
#google-cloud-cli-app-engine-python
#google-cloud-cli-app-engine-python-extras
#google-cloud-cli-bigtable-emulator
#google-cloud-cli-cbt
#google-cloud-cli-cloud-build-local
#google-cloud-cli-cloud-run-proxy
#google-cloud-cli-config-connector
#google-cloud-cli-datastore-emulator
#google-cloud-cli-firestore-emulator
#google-cloud-cli-gke-gcloud-auth-plugin
#google-cloud-cli-kpt
#google-cloud-cli-kubectl-oidc
#google-cloud-cli-local-extract
#google-cloud-cli-minikube
#google-cloud-cli-nomos
#google-cloud-cli-pubsub-emulator
#google-cloud-cli-skaffold
#google-cloud-cli-spanner-emulator
#google-cloud-cli-terraform-validator
#google-cloud-cli-tests
#kubectl
#


# Login
gcloud auth login

# List projects
gcloud projects list



#########################################################
# Note, I used the cloud console to create an oauth token, but here are the untested gcloud cli commands

# Create OAuth client
gcloud iam oauth-clients create APP_OAUTH_CLIENT_ID \
    --project=PROJECT_ID \
    --location=global \
    --client-type="CONFIDENTIAL_CLIENT" \
    --display-name="My OAuth application" \
    --description="An application registration for MyApp" \
    --allowed-scopes="https://www.googleapis.com/auth/cloud-platform" \
    --allowed-redirect-uris="REDIRECT_URI" \
    --allowed-grant-types="authorization_code_grant"

# List OAuth client
gcloud iam oauth-clients list \
    --project=financial-model-cloud \
    --location=global

# Create credential
gcloud iam oauth-clients credentials create APP_OAUTH_CLIENT_CREDENTIAL_ID \
    --oauth-client=APP_OAUTH_CLIENT_ID \
    --display-name='My OAuth client credential' \
    --location='global'

# List credential
gcloud iam oauth-clients credentials list \
    --oauth-client=APP_OAUTH_CLIENT_ID \
    --project=financial-model-cloud \
    --location=global
    YOUR_GOOGLE_CLIENT_ID

# For describe, update, delete, disable, see the docs
https://docs.cloud.google.com/iam/docs/workforce-manage-oauth-app
#########################################################

# Configure CLI with google project
gcloud config set project financial-model-cloud

# Export project as a variable
export CLOUDSDK_CORE_PROJECT=financial-model-cloud

# Phase 1, Task 2: Enable necessary Google Cloud APIs
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Phase 1, Task 3: Provision a new Google Cloud SQL for PostgreSQL instance.
# List regions
gcloud compute regions list

# Create instance (This takes about 12 minutes)
gcloud sql instances create finmodel-postgres-instance \
  --database-version=POSTGRES_13 \
  --region=us-east1 \
  --tier=db-f1-micro \
  --root-password=bolaudersez88 \
  --storage-size=20GB \
  --storage-type=SSD \
  --availability-type=REGIONAL

# Create a database
gcloud sql databases create finmodel1 \ --instance=finmodel-postgres-instance

# Create a dedicated user
## NOTE: --host=%: Allows connection from any host (necessary for Cloud Run to connect)
## NOTE: Password does not have to be the same as above
gcloud sql users create dbadmin \
  --host=% \
  --instance=finmodel-postgres-instance \
  --password=bolaudersez88

# Phase 1, Task 5: Configure Cloud SQL connectivity.
## NOTE:
For simplicity in this initial deployment, we will enable Public IP on your Cloud SQL instance. While Private IP is generally more secure and recommended for production (as it uses a VPC connector), enabling Public IP first will allow us to get the application working end-to-end more quickly. We can always switch to Private IP later.
Please note: When you enable Public IP, it's good practice to authorize specific networks (like your home/office IP) if you plan to connect directly with database tools. However, for Cloud Run, we'll be using the Cloud SQL Python Connector, which securely handles connections without needing to whitelist Cloud Run's dynamic IP addresses.
To enable Public IP on your Cloud SQL instance, run the following command in your terminal. Remember to replace YOUR_INSTANCE_NAME with the name of your Cloud SQL instance.

gcloud sql instances patch INSTANCE_NAME --assign-ip

# Show assigned IP
gcloud sql instances describe finmodel-postgres-instance | yq .ipAddresses

# Assign an anywhere network temporarily
NOTE: This will overwrite existing authorized networks. To get current values, run
gcloud sql instances describe finmodel-postgres-instance | yq .settings.ipConfiguration
You can assign multiple with this
gcloud sql instances patch INSTANCE_ID \
--authorized-networks=NETWORK_RANGE_1,NETWORK_RANGE_2...
   
gcloud sql instances patch finmodel-postgres-instance --authorized-networks=0.0.0.0/0

# Phase 1, Task 6: Ensure the Cloud Run service account has appropriate permissions to connect to Cloud SQL.

# Get the default Cloud Run service account for your project.
gcloud projects describe financial-model-cloud --format="value(projectNumber)"
526419047208

gcloud sql instances describe finmodel-postgres-instance --format="value(connectionName)"
financial-model-cloud:us-east1:finmodel-postgres-instance

gcloud projects add-iam-policy-binding financial-model-cloud --member="serviceAccount:526419047208-compute@developer.gserviceaccount.com" --role="roles/cloudsql.client"

# Phase 2: Backend Deployment (Cloud Run).
# Task 7 and 8: Update api/requirements.txt to include cloud-sql-python-connector. Update api/config.py to dynamically construct DATABASE_URL
Instead of a standard PostgreSQL connection string, Cloud SQL Python Connector uses a specific format and automatically handles secure connections via the Cloud SQL Proxy. We'll modify api/config.py to check for a CLOUD_SQL_CONNECTION_NAME environment variable and construct the DATABASE_URL accordingly.

# Task 9: Modify api/Dockerfile
# Task 10: Build the backend Docker image and push it to Google Artifact Registry.

# Create a new Artifact Registry repository:
gcloud artifacts repositories create finmodel-repo \
   --repository-format=docker \
   --location=us-east1 \
   --description="Docker repository for FinModel application images"
# Configure Docker (or Podman) to authenticate with Artifact Registry:
   gcloud auth configure-docker us-east1-docker.pkg.dev

# Build the backend Docker image: FIX THIS
cd /home/mwilling/git/finmodel_3tier
podman build -t us-east1-docker.pkg.dev/financial-model-cloud/finmodel-repo/finmodel-backend:latest -f ./api/Dockerfile .


# Push the backend Docker image to Artifact Registry
podman push us-east1-docker.pkg.dev/financial-model-cloud/finmodel-repo/finmodel-backend:latest


# Task 11: Deploy the backend container to Google Cloud Run, configuring environment variables
gcloud run deploy finmodel-backend-service --image=us-east1-docker.pkg.dev/financial-model-cloud/finmodel-repo/finmodel-backend:latest --region=us-east1 --platform=managed --allow-unauthenticated --add-cloudsql-instances=financial-model-cloud:us-east1:finmodel-postgres-instance --set-env-vars=USE_SECRET_MANAGER_FOR_ENV_VARS


######################################################################
Start and Stop GCP PostgreSQL
# 
# Start
gcloud sql instances patch finmodel-postgres-instance \
--activation-policy=ALWAYS

# Stop
gcloud sql instances patch finmodel-postgres-instance \
--activation-policy=NEVER

# Restart
gcloud sql instances restart finmodel-postgres-instance

#######################################################################

#######
gcloud config set project financial-model-cloud
gcloud sql databases list --instance=finmodel-postgres-instance
