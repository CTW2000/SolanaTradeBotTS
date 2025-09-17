import {
    AccountInfo,
    AddressLookupTableAccount,
    AddressLookupTableProgram,
    PublicKey,
  } from '@solana/web3.js'; 
import { connection } from '../../config';

// manages Address Lookup Tables (ALTs)

class LookupTableProvider {

  //Caches lookup table accounts by their address
    lookupTables: Map<string, AddressLookupTableAccount> |any;
    //Maps each lookup table to the set of addresses it contains
    addressesForLookupTable: Map<string, Set<string>>|any;
   //Maps each address to the lookup tables that contain it
    lookupTablesForAddress: Map<string, Set<string>>|any;

    constructor() {
        this.lookupTables = new Map();
        this.lookupTablesForAddress = new Map();
        this.addressesForLookupTable = new Map(); 
      }
   
    
      //Called whenever a new lookup table is fetched
      //Builds bidirectional mappings between tables and addresses
      //Updates the internal cache when a lookup table is loaded
      private updateCache(
        lutAddress: PublicKey,
        lutAccount: AddressLookupTableAccount,
      ) {
        this.lookupTables.set(lutAddress.toBase58(), lutAccount);
    
        this.addressesForLookupTable.set(lutAddress.toBase58(), new Set());
    
        for (const address of lutAccount.state.addresses) {
          const addressStr = address.toBase58();
          this.addressesForLookupTable.get(lutAddress.toBase58()).add(addressStr);
          if (!this.lookupTablesForAddress.has(addressStr)) {
            this.lookupTablesForAddress.set(addressStr, new Set());
          }
          this.lookupTablesForAddress.get(addressStr).add(lutAddress.toBase58());
        }
      }
   
      private processLookupTableUpdate(
        lutAddress: PublicKey,
        data: AccountInfo<Buffer>,
      ) {
        const lutAccount = new AddressLookupTableAccount({
          key: lutAddress,
          state: AddressLookupTableAccount.deserialize(data.data),
        });
    
        this.updateCache(lutAddress, lutAccount);
        return;
      }

    //Retrieves a lookup table by its address
      async getLookupTable(
        lutAddress: PublicKey,
      ): Promise<AddressLookupTableAccount | undefined | null> {
        const lutAddressStr = lutAddress.toBase58();
        if (this.lookupTables.has(lutAddressStr)) {
          return this.lookupTables.get(lutAddressStr);
        }
    
        const lut = await connection.getAddressLookupTable(lutAddress);
        if (lut.value === null) {
          return null;
        }
    
        this.updateCache(lutAddress, lut.value);
    
        return lut.value;
      }

      // Determines the optimal lookup tables to use for a given set of addresses
      computeIdealLookupTablesForAddresses(
        addresses: PublicKey[],
      ): AddressLookupTableAccount[] {
        const MIN_ADDRESSES_TO_INCLUDE_TABLE = 2;
        const MAX_TABLE_COUNT = 3;
    
        const addressSet = new Set<string>();
        const tableIntersections = new Map<string, number>();
        const selectedTables: AddressLookupTableAccount[] = [];
        const remainingAddresses = new Set<string>();
        let numAddressesTakenCareOf = 0;
    //Finds which lookup tables contain each address
    //Counts intersections (how many addresses each table covers)
    //Selects tables that cover the most addresses
    //Array of optimal lookup table accounts



        for (const address of addresses) {
          const addressStr = address.toBase58();
    
          if (addressSet.has(addressStr)) continue;
          addressSet.add(addressStr);
    
          const tablesForAddress =
            this.lookupTablesForAddress.get(addressStr) || new Set();
    
          if (tablesForAddress.size === 0) continue;
    
          remainingAddresses.add(addressStr);
    
          for (const table of tablesForAddress) {
            const intersectionCount = tableIntersections.get(table) || 0;
            tableIntersections.set(table, intersectionCount + 1);
          }
        }
    
        const sortedIntersectionArray = Array.from(
          tableIntersections.entries(),
        ).sort((a, b) => b[1] - a[1]);
    
        for (const [lutKey, intersectionSize] of sortedIntersectionArray) {
          if (intersectionSize < MIN_ADDRESSES_TO_INCLUDE_TABLE) break;
          if (selectedTables.length >= MAX_TABLE_COUNT) break;
          if (remainingAddresses.size <= 1) break;
    
          const lutAddresses :any= this.addressesForLookupTable.get(lutKey);
    
          const addressMatches = new Set(
            [...remainingAddresses].filter((x) => lutAddresses.has(x)),
          );
    
          if (addressMatches.size >= MIN_ADDRESSES_TO_INCLUDE_TABLE) {
            selectedTables.push(this.lookupTables.get(lutKey));
            for (const address of addressMatches) {
              remainingAddresses.delete(address);
              numAddressesTakenCareOf++;
            }
          }
        }
    
        return selectedTables;
      }
    }

 
    const lookupTableProvider = new LookupTableProvider();
  
    lookupTableProvider.getLookupTable(
      // custom lookup tables
      new PublicKey('Gr8rXuDwE2Vd2F5tifkPyMaUR67636YgrZEjkJf9RR9V'),
    );
    
    export { lookupTableProvider };




