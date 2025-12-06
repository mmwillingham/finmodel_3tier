# Install postgresql in local container
```
# Create data directory
mkdir -p /home/mwilling/pgdata/finmodel

# Install Podman (if not already installed):
sudo dnf install podman

# Install psql
sudo dnf install psql -y

# Pull the PostgreSQL image:
podman pull docker.io/library/postgres

# Run the PostgreSQL container
podman run \
  --name finmodel-data \
  -e POSTGRES_USER=bolauder \
  -e POSTGRES_PASSWORD=iamhe123 \
  -e POSTGRES_DB=finmodel \
  -p 5432:5432 \
  -v /home/mwilling/pgdata/finmodel:/var/lib/postgresql \
  -d postgres:latest

# Verify pod is running
podman ps

# Open firewall
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --reload

# Connect to it
psql -h 127.0.0.1 -p 5432 -U bolauder -d postgres
