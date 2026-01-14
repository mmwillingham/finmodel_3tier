# finmodel_3tier
## Notes

### Credentials
https://console.cloud.google.com/apis/credentials?project=financial-model-cloud

OAuth 2.0 Client IDs
Authorized JavaScript origins: 
- https://finmodel-frontend-service-msdi7jcivq-ue.a.run.app

Authorized redirect URIs:
- https://finmodel-backend-service-msdi7jcivq-ue.a.run.app/auth/google/callback

### Secrets
https://console.cloud.google.com/security/secret-manager?project=financial-model-cloud
_DB_PASSWORD
_GOOGLE_CLIENT_ID
_GOOGLE_CLIENT_SECRET
_MAIL_PASSWORD
_SECRET_KEY


### Triggers
```
https://console.cloud.google.com/cloud-build/triggers?invt=AcFsNQ&project=financial-model-cloud
$ gcloud builds triggers describe finmodel-ci-cd --region=us-east1
createTime: '2025-12-16T15:56:53.693595831Z'
filename: cloudbuild.yaml
github:
  name: finmodel_3tier
  owner: mmwillingham
  push:
    branch: ^main$
id: fb6af1a6-f218-449d-94ed-347c65b56b69
name: finmodel-ci-cd
resourceName: projects/financial-model-cloud/locations/us-east1/triggers/fb6af1a6-f218-449d-94ed-347c65b56b69
serviceAccount: projects/financial-model-cloud/serviceAccounts/526419047208-compute@developer.gserviceaccount.com
substitutions:
  _CLOUD_SQL_CONNECTION_NAME: financial-model-cloud:us-east1:finmodel-postgres-instance
  _CORS_ORIGINS_REGEX: https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?|https?://finmodel-frontend-service-526419047208\\.us-east1\\.run\\.app
  _DB_NAME: finmodel1
  _DB_USER: dbadmin
  _FRONTEND_URL: https://finmodel-frontend-service-526419047208.us-east1.run.app
  _GOOGLE_CLIENT_ID: 526419047208-tk8dkcvn20cidc8sdi6d2n3kgpg81eu6.apps.526419047208-tk8dkcvn20cidc8sdi6d2n3kgpg81eu6.apps.googleusercontent.com
  _MAIL_FROM: no_reply@gmail.com
  _MAIL_PORT: '587'
  _MAIL_SERVER: smtp.gmail.com
  _MAIL_SSL: 'False'
  _MAIL_TLS: 'True'
  _MAIL_USERNAME: martin.willingham@gmail.com
  _PUBLIC_BACKEND_URL: https://finmodel-backend-service-526419047208.us-east1.run.app
  _USE_CREDENTIALS: 'True'
  _VALIDATE_CERTS: 'True'
```

