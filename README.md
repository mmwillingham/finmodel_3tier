README

## Deployment (Google Cloud)

Backend and frontend are deployed via Cloud Build to Cloud Run. See `cloudbuild.yaml`.

### 403 on API (e.g. POST /projections) after a GCP redo

- **Application 403**: Free-tier limit — e.g. "Free plan supports up to X projection years." The UI now shows this message when the API returns it. Reduce projection years or upgrade the account.
- **CORS**: The request Origin must match `_CORS_ORIGINS_REGEX` in your Cloud Build trigger. If users open the app at **https://ordaxium.com** (no www), the dev regex must include `https://ordaxium\.com` as well as `https://www\.ordaxium\.com`. Suggested trigger values:
  - **dev** (ordaxium.com only): `^(http://localhost:3000|https://ordaxium\.com|https://www\.ordaxium\.com|https://mmr-dev-frontend-service-.*\.run\.app)$`
  - **prod** (modelmyretirement.com only; no ordaxium): `^(https://www\.modelmyretirement\.com|https://mmr-frontend-service-.*\.run\.app)$`
- **IAP**: Do not put Identity-Aware Proxy in front of the API. The app uses its own JWT auth; IAP would return 403 for browser requests. Point the API domain (e.g. `api.ordaxium.com`) directly at the Cloud Run service with `--allow-unauthenticated`.