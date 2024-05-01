#!/bin/bash

db_path="$HOME/.config/realive/realive.db"
blob_path="$HOME/.config/realive/blob"

if [ ! -f "$db_path" ]; then
  echo "Database already does not exist."
  echo "Creating a new, empty database."
  touch "$db_path"
  exit 0
fi

# Delete and recreate the database
rm "$db_path"
touch "$db_path"
# Delete the blob directory
rm -rf "$blob_path"
echo "Database & blob storage nuked successfully."