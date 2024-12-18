from pymongo import MongoClient

# MongoDB connection setup using IPv4 address
uri = "mongodb://127.0.0.1:27017"  # Connection string
client = MongoClient(uri)

# Database and Collections creation
db_name = "DecentraPay"  # The database name
collections = ["CryptoPrices", "Orders", "PaidOrders"]  # The collection names

# Check if database already exists
def database_exists(client, db_name):
    return db_name in client.list_database_names()

def drop_database(client, db_name):
    client.drop_database(db_name)
    print(f"Database '{db_name}' has been dropped.")

def main():
    print("Checking for existing database...")
    if database_exists(client, db_name):
        print(f"Warning: The database '{db_name}' already exists.")
        user_input = input("Do you want to overwrite the database? This will DELETE all existing data. (yes/no): ").strip().lower()
        if user_input == 'yes':
            drop_database(client, db_name)
        else:
            print("Exiting without making changes.")
            client.close()
            return

    # Create new database and collections
    db = client[db_name]
    for collection in collections:
        db.create_collection(collection)
        print(f"Collection '{collection}' created in database '{db_name}'.")
    
    # List collections to verify
    print("\nCollections in the database '", db_name, "':", sep="")
    print(db.list_collection_names())

    # Close the connection
    client.close()
    print("Connection closed.")

if __name__ == "__main__":
    main()