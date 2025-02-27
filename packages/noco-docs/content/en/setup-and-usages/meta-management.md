---
title: 'Team & Settings > Data Sources'
description: 'NocoDB Data-Source sync, access control & re-config'
position: 600
category: 'Product'
menuTitle: 'Team & Settings > Data Sources'
---

## Overview

`Data Sources` sub-menu includes 
- Database Metadata
- UI Access Control
- ERD
- Add/Remove new data source
- Edit existing data source configuration
- Edit data source visibility options  

Note that, currently only one external data source can be added per project.

## Accessing Data Sources

To access it, click the down arrow button next to Project Name on the top left side, then select `Team & Settings` and clicking `Data Sources`.

<img width="322" alt="image" src="https://user-images.githubusercontent.com/35857179/194856648-67936db0-ee4d-4060-be3d-af9f86ef8fc6.png">

![image](https://user-images.githubusercontent.com/35857179/219833316-1fb234f0-583f-4ab8-b8d7-a6e249e7cd97.png)

## Sync Metadata

Go to `Data Sources`, click ``Sync Metadata``, you can see your metadata sync status. If it is out of sync, you can sync the schema. See <a href="./sync-schema">Sync Schema</a> for more.0

![image](https://user-images.githubusercontent.com/35857179/219833485-3bcaa6ec-88bc-47cc-b938-5abb4835dc31.png)

## UI Access Control

Go to `Data Sources`, click ``UI ACL``, you can control the access to each table by roles. 

![image](https://user-images.githubusercontent.com/35857179/219833072-20e9f4ad-fd1c-4e96-9112-6edda1447ec6.png)

## ERD

Go to `Data Sources`, click ``ERD``, you can see the ERD of your database.

![image](https://user-images.githubusercontent.com/35857179/219832288-f6266544-a259-4667-95d9-0e5ce7ac5d27.png)

### Junction table names within ERD

- Enable `Show M2M Tables` within `Project Settings` menu
- Double click on `Show Columns` to see additional checkboxes get enabled.
  - Enabling which you should be able to see junction tables and their table names.

![image](https://user-images.githubusercontent.com/35857179/219832436-9c1311c3-854c-4b31-9c94-8035dfba2a2b.png)

## Edit external database configuration parameters

Go to `Data Sources`, click ``Edit``, you can re-configure database credentials.  
Please make sure database configuration parameters are valid. Any incorrect parameters could lead to schema loss!
  
![image](https://user-images.githubusercontent.com/35857179/219832592-14209cbf-d980-4e14-9a59-bda1b778a74e.png)

## Unlink data source

Go to `Data Sources`, click ``Delete`` against the data source that you wish to un-link.
  
![image](https://user-images.githubusercontent.com/35857179/219832810-a3e9ed88-f732-4f30-9228-ff782be0b9d6.png)
  
## Data source visibility

Go to `Data Sources`, toggle ``Radio-button`` against the data source that you wish to hide/un-hide.
  
![image](https://user-images.githubusercontent.com/35857179/219832914-f485099c-423f-4df8-bf00-b509288efe6d.png)