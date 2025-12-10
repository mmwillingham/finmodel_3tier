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

# Remove data folder if exists
sudo rm -rf /home/mwilling/pgdata/finmodel

# Create a named volume
podman volume create finmodel_pg_data

# Run the PostgreSQL container
podman run \
  --name finmodel-data \
  -e POSTGRES_USER=bolauder \
  -e POSTGRES_PASSWORD=iamhe123 \
  -e POSTGRES_DB=finmodel \
  -p 5432:5432 \
  -v finmodel_pg_data:/var/lib/postgresql \
  -d \
  postgres:latest

# Verify pod is running
podman ps

# Check logs
podman logs finmodel-data

# Open firewall
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --reload

# Connect to it
psql -h 127.0.0.1 -p 5432 -U bolauder -W iamhe123 -d finmodel
exit

# Create the database and verify it exists
PGPASSWORD=iamhe123 podman exec -it finmodel-data psql -h 127.0.0.1 -p 5432 -U bolauder -d postgres -c "CREATE DATABASE finmodel;"
PGPASSWORD=iamhe123 podman exec -it finmodel-data psql -h 127.0.0.1 -p 5432 -U bolauder -d postgres -c "SELECT 1 FROM pg_catalog.pg_database WHERE datname = 'finmodel';"

# To delete database
drop database finmodel

Add to environment variable for api terminal:
DATABASE_URL="postgresql://bolauder:iamhe123@127.0.0.1:5432/finmodel"

to turn paging off
psql -P pager=off

PGPASSWORD=iamhe123 podman exec -it finmodel-data psql -P pager=off -h 127.0.0.1 -p 5432 -U bolauder -d finmodel -c "\d cashflow_items"
