podman stop finmodel-data
podman rm finmodel-data
podman run \
  --name finmodel-data \
  -e POSTGRES_USER=bolauder \
  -e POSTGRES_PASSWORD=iamhe123 \
  -e POSTGRES_DB=finmodel \
  -p 5432:5432 \
  -v /home/mwilling/pgdata/finmodel:/var/lib/postgresql \
  -d postgres:latest
