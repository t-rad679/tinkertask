# GCP Deployment Guide (Tasks 14.3 + 14.4)

These are the manual steps to deploy tinkertask-backend to Cloud Run using your own GCP credentials.
Replace `PROJECT` and `REGION` throughout with your actual GCP project ID and region (e.g. `us-central1`).

## Prerequisites

- `gcloud` CLI authenticated (`gcloud auth login && gcloud config set project PROJECT`)
- Docker installed and authenticated to Artifact Registry (`gcloud auth configure-docker REGION-docker.pkg.dev`)

## Steps

### 1. Create GCP infrastructure

```bash
# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

# Create Artifact Registry repo
gcloud artifacts repositories create tinkertask \
  --repository-format=docker \
  --location=REGION

# Create Cloud SQL (Postgres 16) instance
gcloud sql instances create tinkertask-pg \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=REGION

gcloud sql databases create tinkertask --instance=tinkertask-pg
gcloud sql users create tinkertask --instance=tinkertask-pg --password=<strong-password>

# Create secrets
gcloud secrets create tinkertask-db-url --replication-policy=automatic
echo -n "postgresql://tinkertask:<password>@localhost/tinkertask?host=/cloudsql/PROJECT:REGION:tinkertask-pg" \
  | gcloud secrets versions add tinkertask-db-url --data-file=-

gcloud secrets create firebase-admin-email --replication-policy=automatic
echo -n "<firebase-client-email>" | gcloud secrets versions add firebase-admin-email --data-file=-

gcloud secrets create firebase-admin-private-key --replication-policy=automatic
# Paste the private key (with literal \n for newlines) into a file first, then:
gcloud secrets versions add firebase-admin-private-key --data-file=firebase-private-key.txt

gcloud secrets create tinkertask-allowlist --replication-policy=automatic
echo -n "you@example.com,other@example.com" | gcloud secrets versions add tinkertask-allowlist --data-file=-
```

### 2. Build and push the Docker image

From the **repo root** (not `server/`):

```bash
docker build -f server/Dockerfile \
  -t REGION-docker.pkg.dev/PROJECT/tinkertask/backend:latest \
  .

docker push REGION-docker.pkg.dev/PROJECT/tinkertask/backend:latest
```

### 3. Update the service manifest

Edit `server/src/deploy/cloud-run-service.yaml` and replace every occurrence of:
- `PROJECT` with your GCP project ID
- `REGION` with your chosen region (e.g. `us-central1`)

### 4. Deploy to Cloud Run

```bash
gcloud run services replace server/src/deploy/cloud-run-service.yaml --region REGION

# Allow unauthenticated invocations (auth handled by Firebase/PAT in-app)
gcloud run services add-iam-policy-binding tinkertask-backend \
  --region=REGION \
  --member=allUsers \
  --role=roles/run.invoker
```

### 5. Grant Cloud Run access to secrets and Cloud SQL

```bash
# Get the Cloud Run service account
SA=$(gcloud run services describe tinkertask-backend --region=REGION \
  --format='value(spec.template.spec.serviceAccountName)')

# Grant secret access
for SECRET in tinkertask-db-url firebase-admin-email firebase-admin-private-key tinkertask-allowlist; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SA" \
    --role=roles/secretmanager.secretAccessor
done

# Grant Cloud SQL client access
gcloud projects add-iam-policy-binding PROJECT \
  --member="serviceAccount:$SA" \
  --role=roles/cloudsql.client
```

### 6. Production smoke test

```bash
URL=$(gcloud run services describe tinkertask-backend --region=REGION --format='value(status.url)')

# Using a Personal Access Token (seed one first via POST /v1/personal-access-tokens)
curl -s \
  -H "Authorization: Bearer <your-PAT>" \
  "$URL/v1/sync?since=2026-01-01T00:00:00Z" | jq

# Expected response shape:
# { "now": "2026-...", "data": { "tasks": [], "completions": [], ... } }
```

If the response matches the expected envelope, deployment is complete.
Commit the verified deployment with: `chore: post-deploy smoke recorded`.
