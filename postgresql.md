# Install postgresql in local container
```
# Create data directory
mkdir -p /home/mwilling/pgdata/finmodel

# Install Podman (if not already installed):
sudo dnf install podman

# Pull the PostgreSQL image:
podman pull postgres:16

# Run the PostgreSQL container
podman run \
  --name my-postgres \
  -e POSTGRES_USER=bolauder \
  -e POSTGRES_PASSWORD=iamhe123 \
  -p 5432:5432 \
  -v //home/mwilling/pgdata/finmodel:/var/lib/postgresql/data \
  -d postgres:16

# Verify pod is running
podman ps

# Connect to it
psql -h 127.0.0.1 -p 5432 -U bolauder -d postgres
