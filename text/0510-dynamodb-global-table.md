# AWS DynamoDB Global Table L2 Construct

* **Original Author(s):**: @vinayak-kukreja
* **Tracking Issue**: #510
* **API Bar Raiser**: @rix0rrr

Users will now be able to replicate their DynamoDB table to multiple regions using the Global Table L2 construct.
This feature will be using the CloudFormation resource for global table and users will no longer need to rely
custom resources for provisioning global tables.

## Working Backwards

The following is ReadMe for DynamoDB Global Table.

__NOTE:__ This just includes properties that are different from the Table construct. For an in detailed comparision
between properties, take a look at the [appendix](#difference-between-tableprops-and-globaltableprops).

### DynamoDB Global Table

[DynamoDB Global Table](https://aws.amazon.com/dynamodb/global-tables/) lets you provision a table that can be
replicated across different regions. It can also be deployed to just one region and will cost the same as a
single DynamoDB table.

It is also multi-active database, that means there is no primary table and all the tables created as called
as replicas and all replicas support reads and writes. Writes to a replica are eventually propagated to other
replicas where conflicts are resolved by 'last writer wins'.

#### Read and Write Capacity

Global tables by default have `BillingMode.PAY_PER_REQUEST`. If you choose the `BillingMode.PROVISIONED` mode,
then you will need to specify read and write capacities. If these values are specified at global table level, then
those values are used for each replica and its global secondary indexes(GSIs).

```typescript
new GlobalTable(tableStack, 'GlobalTable', {
  tableName: 'FooTable',
  partitionKey: {
    name: 'FooHashKey',
    type: AttributeType.STRING,
  },
  billingMode: BillingMode.PROVISIONED,
  write: Capacity.autoscaled({ max: 70 }),
  read: Capacity.fixed(20),
  replicas: [
    {
      region: 'us-west-1',
    },
    {
      region: 'us-east-2',
    },
  ],
});
```

__NOTE:__

* Provisioned mode for write capacity can only be used with autoscaling configuration. There is no way to
provision fixed write capacity units in global tables.
* Write capacity for tables(all replicas) or GSIs cannot be configured on a per replica basis. You can only
modify read capacity per replica.

#### Replicas

You can define replicas for your global table. By default, a single table is deployed in the stack's region.

You only need to define replicas for other regions or if you will like to configure the default replica i.e. the replica
in the stack region.

For instance, the following would create a replica in `us-west-2`(stack's region), `us-east-1` and `us-east-2`.

```typescript
const app = new App();
const tableStack = new Stack(app, 'GlobalTableStack', {
  env: {
    region: 'us-west-2',
  },
});

new GlobalTable(tableStack, 'GlobalTable', {
  tableName: 'FooTable',
  partitionKey: {
    name: 'FooHashKey',
    type: AttributeType.STRING,
  },
  replicas: [
    {
      region: 'us-west-1',
    },
    {
      region: 'us-east-2',
    },
  ],
});
```

You can also add a replica using `addReplica` method.

```typescript
globalTable.addReplica({
  region: 'us-east-1',
});
```

##### Properties

There are per replica properties that are available.

* `region` --> Needs to be specified
* `contributorInsightsEnabled` --> Gets copied over from global table level props if defined.
* `deletionProtection` --> Gets copied over from global table level props if defined.
* `pointInTimeRecovery` --> Gets copied over from global table level props if defined.
* `tableClass` --> Gets copied over from global table level props if defined.
* `tags` --> Gets copied over from global table level props if defined.
* `read` --> Gets copied over from global table level props if defined.
* `encryptionKey` --> This needs to be defined per replica
* `kinesisStream` --> This needs to be defined per replica
* `globalSecondaryIndexOptions`
  * `indexName` --> Needs to be specified
  * `contributorInsightsEnabled` --> Gets copied over from global table level props or replica level props if defined.
  * `read` --> Gets copied over from either table level GSI props or replica level props or global table level props.

##### Capacities

Write capacity cannot be configured for replicas but read capacity can be specified for replicas.

You only need to specify read capacity if you want it to be different from the global table level
value. If its undefined, it uses the table global table level value.

```typescript
new GlobalTable(tableStack, 'GlobalTable', {
  tableName: 'FooTable',
  partitionKey: {
    name: 'FooHashKey',
    type: AttributeType.STRING,
  },
  billingMode: BillingMode.PROVISIONED,
  write: Capacity.autoscaled({ max: 70 }),
  read: Capacity.fixed(20),
  replicas: [
    {
      region: 'us-west-1',
      read: Capacity.autoscaled({ max: 60 }),
    },
    {
      region: 'us-east-2',
    },
  ],
});
```

__NOTE:__

* We automatically deploy a replica to the stack region. User only needs to specify additional replication regions.
* User can add as many replicas when creating the table. But, after that you can only add/remove a single replica
in a stack update.

#### Global Secondary Indexes

You can add global secondary indexes(GSIs) to your global table. These will be the same for each replica of the
table.

```typescript
new GlobalTable(tableStack, 'GlobalTable', {
  tableName: 'FooTable',
  partitionKey: {
    name: 'FooHashKey',
    type: AttributeType.STRING,
  },
  sortKey: {
    name: 'FooRangeKey',
    type: AttributeType.STRING,
  },
  globalSecondaryIndex: [{
    indexName: 'UniqueGsiName',
    partitionKey: {
      name: 'FooRangeKey',
      type: AttributeType.STRING,
    },
  }],
  replicas: [{
    region: 'us-east-1',
  }],
});
```

You can add global secondary index with `addGlobalSecondaryIndex` method.

```typescript
globalTable.addGlobalSecondaryIndex({
  indexName: 'UniqueGsiName',
  partitionKey: { name: 'FooRangeKey', type: AttributeType.STRING },
});
```

You can also allocate capacities for your GSIs:

* You only need to provide write and read capacity for GSIs where you want it to be different than capacity specified
for the global table. If not specified, it uses the same value as that of the global table.

  ```typescript
  new GlobalTable(tableStack, 'GlobalTable', {
    tableName: 'FooTable',
    partitionKey: {
      name: 'FooHashKey',
      type: AttributeType.STRING,
    },
    sortKey: {
      name: 'FooRangeKey',
      type: AttributeType.STRING,
    },
    billingMode: BillingMode.PROVISIONED,
    write: Capacity.autoscaled({ max: 70 }),
    read: Capacity.fixed(40),
    globalSecondaryIndex: [{
      indexName: 'UniqueGsiName',
      partitionKey: {
        name: 'FooRangeKey',
        type: AttributeType.STRING,
      },
      write: Capacity.autoscaled({ max: 90 }),
      read: Capacity.autoscaled({ max: 60 }),
    }],
    replicas: [{
      region: 'us-east-1',
    }],
  });
  ```

* You can provide read capacity for GSIs where you want it to be different than the capacity specified for the replica.

  ```typescript
  new GlobalTable(tableStack, 'GlobalTable', {
    tableName: 'FooTable',
    partitionKey: {
      name: 'FooHashKey',
      type: AttributeType.STRING,
    },
    sortKey: {
      name: 'FooRangeKey',
      type: AttributeType.STRING,
    },
    billingMode: BillingMode.PROVISIONED,
    write: Capacity.autoscaled({ max: 70 }),
    globalSecondaryIndex: [{
      indexName: 'UniqueGsiName',
      partitionKey: {
        name: 'FooRangeKey',
        type: AttributeType.STRING,
      },
    }],
    replicas: [{
      region: 'us-east-1',
      read: Capacity.autoscaled({ max: 70 }),
      globalSecondaryIndexOptions: [
        {
          indexName: 'UniqueGsiName',
          read: Capacity.fixed(55),
        },
      ],
    }],
  });
  ```

__NOTE:__

* You can create up to 20 global secondary indexes.
* You can only create or delete one global secondary index in a single stack operation.

#### Local Secondary Indexes

You can add local secondary indexes to your global table. These will be the same for each replica of
the table.

```typescript
const globalTable = new GlobalTable(stack, 'FooTable', {
  partitionKey: { name: 'Foo', type: AttributeType.STRING },
  sortKey: { name: 'Bar', type: AttributeType.STRING },
  localSecondaryIndex: [
    {
      indexName: 'FooTableLsi',
      sortKey: { name: 'Foo', type: AttributeType.STRING },
    },
  ],
});
```

You can add local secondary index with `addLocalSecondaryIndex` method.

```typescript
globalTable.addLocalSecondaryIndex({
  indexName: 'FooTableLsi',
  sortKey: { name: 'Foo', type: AttributeType.STRING },
});
```

__NOTE:__

* You need a sort key to define a local secondary index.
* You can create up to five local secondary indexes.

#### Encryption

Encryption mode is similar to Table construct and will be the same for each replica. There are now four types
of encryptions that are available for global tables.

1. `AWS_OWNED`: This uses a KMS key for encryption that is owned by DynamoDB. This is the default
for global tables.
2. `AWS_MANAGED`: A KMS key is created in your account and is managed by AWS.
3. `KEY_ARNS`: [NEW] You will provide KMS key arns for each replica. You will need to specify arns for each
replica region. The key also needs to be in the same region as the replica.
4. `MULTI_REGION_KEY`: [NEW] A multi region KMS key and its supporting stacks in replica regions will be
provisioned automatically.

__NOTE__:

* Encryption mode `CUSTOMER_MANAGED` is now deprecated. You can switch to either `KEY_ARNS` or `MULTI_REGION_KEY` mode.

#### Grants

Global table's `replica(region)` method would return an `ITable` reference for the replica in the region. Grant methods
can be used to provide replica specific permissions.

```typescript
class FooStack extends Stack {
  public readonly globalTable: GlobalTable;

  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    this.globalTable = new GlobalTable(this, 'FooTable', {
      tableName: 'FooGlobalTable',
      partitionKey: {
        name: 'FooHashKey',
        type: AttributeType.STRING,
      },
      replicas: [
        {
          region: 'us-west-2',
          encryptionKey: 'FooKmsKeyArn',
        },
        {
          region: 'us-east-1',
          encryptionKey: 'BarKmsKeyArn',
        },
      ],
    });
  }
}

interface BarStackProps extends StackProps {
  table: ITable;
}

class BarStack extends Stack {
  constructor(scope: App, id: string, props: BarStackProps) {
    super(scope, id, props);

    const user = new iam.User(this, 'User');
    props.table.grantReadData(user);
  }
}

const fooStack = new FooStack(app, 'FooStack', {
  env: {
    region: 'us-west-2',
  },
});

const barStack = new BarStack(app, 'BarStack', {
  env: {
    region: 'us-east-1',
  },
  table: fooStack.globalTable.replica('us-east-1'),
});
```

#### Metrics

Similar to grant methods, you can access metrics emitted by global table replicas by using `metric` methods.

```typescript
const globalTable = new GlobalTable(tableStack, 'FooTable', {
  tableName: 'FooGlobalTable',
  partitionKey: {
    name: 'FooHashKey',
    type: AttributeType.STRING,
  },
  replicas: [
    {
      region: 'us-west-2',
    },
    {
      region: 'us-east-1',
    },
  ],
});

const replica = globalTable.replica('us-east-1');
const graphMetric = replica.metricConsumedWriteCapacityUnits();

const dashboard = new Dashboard(
  tableStack,
  'Table-Dashboard',
  {
    dashboardName: 'Dashboard',
  },
);

dashboard.addWidgets(
  new GraphWidget({
    title: 'Consumed Write Capacity Units',
    width: 12,
    left: [
      graphMetric,
    ],
  }),
);
```

#### Importing

You can import an existing global table in your stack by using `from` functions. You will need to specify
either table name, table arn or table attributes to import it.

```typescript
GlobalTable.fromTableName(stack, 'FooTableId', 'FooTable');
```

### NOTE

* We only support version [2019.11.21](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/globaltables.V2.html)
of the global table since CloudFormation just has support for the same.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ

### What are we launching today?

We are launching L2 support for DynamoDB Global Table feature.

### Why should I use this feature?

You should use this feature if,

* You will like to provision a DynamoDB table that has the capability of replicating to other regions.
This will remove the need of creating custom solution for replicating your table to other regions and
decrease maintenance load.
* You want to import global tables using CloudFormation import.
* You want to use drift detection.
* You want to create replicated GSIs for an autoscaled table.

## Internal FAQ

### Why are we doing this?

DynamoDB Global Table L2 support has been requested by our users for a long time. When CDK initally added
support for this feature, CloudFormation support for global tables did not exist. So we had to use
[custom CloudFormation resources](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.custom_resources-readme.html)
within our [Table construct](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_dynamodb-readme.html#amazon-dynamodb-global-tables)
to add support for this feature.

The current implementation has some limitations,

* Some properties are not propagated across replicas.
  * Open Issues: #25740, #25443, #18582
* Customer managed key is not supported with replicationRegions in current solution.
(Issues: #15957)

The current solution also will add maintenance load and cost for custom resource in user stack.
And also blocks users who do not want to use a custom resource solution for provisioning their global tables.

This implementation moves away from the custom resource solution and to the user experience that
global table intented to provide. With CloudFormation now having support for global table resource,
we can now add L2 support for this feature.

### Why should we _not_ do this?

We currently offer two solution to provision a global table,

1. Custom CloudFormation Resource within Table construct
2. L1 for global table resource

This means the customer is not blocked to use global tables. Adding L2 support will take up developer
time and effort and, will also add to maintenance load for the CDK team.

### What is the technical solution (design) of this feature?

#### Replicas

The user will be able to specify list of replicas using `replicas` properties. User would also be add a
single replica using the `addReplica` method.

* If a user just wants to deploy to the region where the stack is being deployed, then they will not need
to specify the replica until they want to configure certain aspects of the replica.
* Properties that are mentioned at the global table level configuration gets copied over to all replicas
if user has left them undefined. If a certain property is defined on a replica level, then that takes
precedence over the global table level value(if present). For instance,

  ```typescript
  new GlobalTable(tableStack, 'GlobalTable', {
    tableName: 'FooTable',
    partitionKey: {
      name: 'FooHashKey',
      type: AttributeType.STRING,
    },
    contributorInsightsEnabled: true,
    replicas: [
      {
        region: 'us-east-1',
      },
      {
        region: 'us-west-2',
        contributorInsightsEnabled: false,
      },
      {
        region: 'us-west-1',
      },
      {
        region: 'us-east-2',
      },
    ],
  });
  ```

  Here, the `contributorInsightsEnabled` is defined at the global table level and that value will be used
  for each replica where this property is undefined. But, you can see `us-west-2` has this property defined
  as `false` and that value will take precedence over the value specified for the table i.e. `true`.

  These are the properties that you can specify on a per replica level or at the global table level to be
  copied over for replicas:

  * `read?: Capacity`
  * `contributorInsightsEnabled?: boolean`
  * `deletionProtection?: boolean`
  * `pointInTimeRecovery?: boolean`
  * `tableClass?: TableClass`
  * `tags?: CfnTag[]`

#### Capacity specifications

The capacity will only be needed to be specified if the provisioning mode is not on-demand. By defaut,
the mode will be on-demand.

The write capacity for table, replicas or GSIs can only be specified with an autoscaling configuration.
Whereas, the read capacity can either be with a fixed capacity unit or with an autoscaling cofiguration.

So, having an enum like class for these two modes, users will have,

* `Capacity.fixed(number)`
* `Capacity.autoscaled({ configuration })`

Now, if the billing mode is provisioned, then each capacity needs to be specified since we are not choosing
defaults for the users. But, to ease the user experience, this API will copy over values where undefined.
The following explains how this works for each,

* __Table__
  User can assign read and write capacity at global table level props and these will be used for each replica
  and GSIs. So the user does not need to define any other value.

  And, if the user wants, they can change certain value for replica or GSI and that will take precedence over
  global table level values. For instance,

  ```typescript
  new GlobalTable(tableStack, 'GlobalTable', {
    tableName: 'FooTable',
    billingMode: BillingMode.PROVISIONED,
    partitionKey: {
      name: 'FooHashKey',
      type: AttributeType.STRING,
    },
    sortKey: {
      name: 'FooRangeKey',
      type: AttributeType.STRING,
    },
    write: Capacity.autoscaled({ max: 70 }),
    read: Capacity.fixed(20),
    globalSecondaryIndex: [{
      indexName: 'UniqueGsiName',
      partitionKey: {
        name: 'FooRangeKey',
        type: AttributeType.STRING,
      },
    }],
    replicas: [
      {
        region: 'us-east-1',
      },
      {
        region: 'us-west-2',
      },
    ],
  });
  ```

  Here, `write: Capacity.autoscaled({ max: 70 })` and the `read: Capacity.fixed(20)` is defined at global
  table level props. These values will be used for each replica and each global secondary index.

* __Replicas__
  User can choose to assign capacity values for each replica. They will still need to specify "write" capacity
  at the global table level , since this value is not configurable per replica. But, they will be able to choose
  "read" capacity per replica.

  ```typescript
  new GlobalTable(tableStack, 'GlobalTable', {
    tableName: 'FooTable',
    billingMode: BillingMode.PROVISIONED,
    partitionKey: {
      name: 'FooHashKey',
      type: AttributeType.STRING,
    },
    sortKey: {
      name: 'FooRangeKey',
      type: AttributeType.STRING,
    },
    write: Capacity.autoscaled({ max: 70 }),
    read: Capacity.autoscaled({ max: 50 }),
    replicas: [{
      region: 'us-west-2',
      read: Capacity.fixed(15),
    },
    {
      region: 'us-east-1',
    }],
  });
  ```

  Here, `write: Capacity.autoscaled({ max: 70 })` is defined and will be the same for each replica. And,
  read capacity is defined for `us-west-2` as `Capacity.fixed(15)` and for `us-east-1` it will just use
  the global table level capacity, i.e., `Capacity.autoscaled({ max: 50 })`.

* __Global Secondary Indexes__
  There are multiple ways to define GSI capacity values.

  For reads and writes,

  * A user can specify value at global table level props. This is mentioned in the prior section for tables.
  * A user can specify value in global secondary index props at global table level.

    ```typescript
    new GlobalTable(tableStack, 'GlobalTable', {
      tableName: 'FooTable',
      billingMode: BillingMode.PROVISIONED,
      partitionKey: {
        name: 'FooHashKey',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'FooRangeKey',
        type: AttributeType.STRING,
      },
      write: Capacity.autoscaled({ max: 70 }),
      read: Capacity.autoscaled({ max: 50 }),
      globalSecondaryIndex: [{
        indexName: 'UniqueGsiName',
        partitionKey: {
          name: 'FooRangeKey',
          type: AttributeType.STRING,
        },
        write: Capacity.autoscaled({ max: 90 }),
        read: Capacity.fixed(16),
      }],
      replicas: [{
        region: 'us-west-2',
      },
      {
        region: 'us-east-1',
      }],
    });
    ```

    Here, the `write and read` capacity specified on table will be used by the replicas. And, the values
    specified for GSI, i.e. `write: Capacity.autoscaled({ max: 90 }) and read: Capacity.fixed(16)` will
    be used by all GSIs.

    If both are specified, the precedence will be

    ```
    GSI capacity at global table level  <---- Capacity at global table level
    ```

  For only reads,

  * A user can specify value at replica level props.

    ```typescript
    new GlobalTable(tableStack, 'GlobalTable', {
      tableName: 'FooTable',
      billingMode: BillingMode.PROVISIONED,
      partitionKey: {
        name: 'FooHashKey',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'FooRangeKey',
        type: AttributeType.STRING,
      },
      write: Capacity.autoscaled({ max: 70 }),
      globalSecondaryIndex: [{
        indexName: 'UniqueGsiName',
        partitionKey: {
          name: 'FooRangeKey',
          type: AttributeType.STRING,
        },
      }],
      replicas: [
        {
          region: 'us-east-1',
          read: Capacity.fixed(10),
          globalSecondaryIndexOptions: [
            {
              indexName: 'UniqueGsiName',
            },
          ],
        },
      ],
    });
    ```

    Here, `read: Capacity.fixed(10)` is defined for `us-east-1` replica. This value for read capacity will
    be used for each GSI in the region. And for write capacity, global table level
    `write: Capacity.autoscaled({ max: 70 })` will be used for the replica and GSIs in the replica region.
    The benefit here will be that the user will not need to define read capacity for each GSI and this still
    gives the flexibility of configuring for just the replica and not affecting other replicas.
  * A user can specify value at replica level GSI props.

    ```typescript
    new GlobalTable(tableStack, 'GlobalTable', {
      tableName: 'FooTable',
      billingMode: BillingMode.PROVISIONED,
      partitionKey: {
        name: 'FooHashKey',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'FooRangeKey',
        type: AttributeType.STRING,
      },
      write: Capacity.autoscaled({ max: 70 }),
      read: Capacity.autoscaled({ max: 50 }),
      globalSecondaryIndex: [{
        indexName: 'UniqueGsiName',
        partitionKey: {
          name: 'FooRangeKey',
          type: AttributeType.STRING,
        },
      }],
      replicas: [
        {
          region: 'us-east-1',
          globalSecondaryIndexOptions: [
            {
              indexName: 'UniqueGsiName',
              read: Capacity.fixed(10),
            },
          ],
        },
      ],
    });
    ```

    Here, `read: Capacity.fixed(10)` is defined for a particular GSI and all other GSIs defined will
    use capacity defined at global table level, i.e. `read: Capacity.autoscaled({ max: 50 }).`. The benefit
    for this is allowing users with an option to define a per GSI(within replica) read capacity configuration.

  If values are specified for each of the above, then the precedence will be

  ```
  GSI capacity defined at replica level <---- GSI capacity defined at global table level
  <---- Capacity defined at replica level <---- Capacity defined at global table level
  ```

#### Per-replica KMS keys

Global table offers users to specify user owned KMS keys for replica. The user will need to define
these keys for each replica.

Global table requires keys to be present in-region of the replica. To support this,

* A new option is added: `KEY_ARNS`, where the user can mention the KMS key arns in their replica
configuration and we will import these to the user stack.

  ```typescript
  new GlobalTable(tableStack, 'GlobalTable', {
    tableName: 'FooTable',
    partitionKey: {
      name: 'FooHashKey',
      type: AttributeType.STRING,
    },
    encryption: GlobalTableEncryption.KEY_ARNS,
    replicas: [
      {
        region: 'us-west-2',
        encryptionKey: 'arn:aws:kms:us-west-2:123456789012:key/12345678-1234-1234-1234-123456780001',
      },
      {
        region: 'us-east-1',
        encryptionKey: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456780002',
      },
    ],
  });
  ```

  Here, `encryptionKey` i.e. KMS key arn will need to be defined for each replica.
* Another new option will be: `MULTI_REGION_KEY`. This will be a multi region KMS key that we provision
for the customer and also provision the supporting stacks in regions where a table replica is present.
This feature probably requires an RFC of its own and can be added at a later point after release.
* The `CUSTOMER_MANAGED` encryption option, will be deprecated and users can then switch to `KEY_ARNS`
or `MULTI_REGION_KEY` options. Our recommendation will be to use `MULTI_REGION_KEY` even if the table
exists only in the stack region.

#### Table references in downstream stacks

Global table construct can be referenced with a `replica(region)` method which when provided with a region
will return an `ITable` specific for the region. This can be used for grants and metrics for replica in a
specific region.

  ```typescript
  class FooStack extends Stack {
    public readonly globalTable: GlobalTable;

    constructor(scope: App, id: string, props: StackProps) {
      super(scope, id, props);

      this.globalTable = new GlobalTable(this, 'FooTable', {
        tableName: 'FooGlobalTable',
        partitionKey: {
          name: 'FooHashKey',
          type: AttributeType.STRING,
        },
        replicas: [
          {
            region: 'us-west-2',
            encryptionKey: 'arn:aws:kms:us-west-2:123456789012:key/12345678-1234-1234-1234-123456780001',
          },
          {
            region: 'us-east-1',
            encryptionKey: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456780002',
          },
        ],
      });
    }
  }

  interface BarStackProps extends StackProps {
    table: ITable;
  }

  class BarStack extends Stack {
    constructor(scope: App, id: string, props: BarStackProps) {
      super(scope, id, props);

      const user = new iam.User(this, 'User');
      props.table.grantReadData(user);
    }
  }

  const fooStack = new FooStack(app, 'FooStack', {
    env: {
      region: 'us-west-2',
    },
  });

  const barStack = new BarStack(app, 'BarStack', {
    env: {
      region: 'us-east-1',
    },
    table: fooStack.globalTable.replica('us-east-1'),
  });
  ```

  Here, global table defined is `FooStack` has two replica regions where `us-west-2` is also the region
  stack is being deployed to. Both of these have the KMS encryption key arns defined by the user and
  these keys. These keys arns will be used by the global table to encrypt the respective replica.
  Now, `BarStack` stack props accepts an `ITable` and provides needed permissions to the IAM user defined
  in the stack. During initialization, the global table replica method `fooStack.globalTable.replica('us-east-1')`
  passes in the ITable reference for `us-east-1` replica. And, the iam user only gets access to reads for
  that `us-east-1` replica.

  __Callouts__:

* For table references, `tableName` property can be mandated for contructing arns for replicas. If not mandated to
keep the API similar, then we can create a predictable way of constructing the tableName instead of relying on the
CloudFormation auto-created name.
* The grant stream functions will not be able to grant stream access to replicas other than the one
deployed in the stack region. This is due to the format of the stream arn which has format:
_arn:aws:dynamodb:region:account-id:table/table-name/stream/timestamp_.

  For [example](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-dynamodb-globaltable.html#aws-resource-dynamodb-globaltable-return-values),

  ```
  arn:aws:dynamodb:us-east-1:123456789012:table/testddbstack-myDynamoDBTable-012A1SL7SMP5Q/stream/2015-11-30T20:10:00.000
  ```

  Due to this, there is no way to reconstruct it for another region since we
  will not be aware of the timestamp value. We can support this by adding a
  lookup function to determine the stream arn or create a CloudFormation custom resource.

* Similar to stream arn, there is an extra attribute associated with global
tables, i.e.[TableId](https://tinyurl.com/tableid-readme). This is also unique
for each replica and if we just refer the attribute, that will return the ID for
the replica that is in the same region as the stack. So, to have operations on these,
we will need to add a lookup function as well.

#### Migration Blog Post

The following is just a short draft of what migration can look like from Table to GlobalTable construct.

__Assumptions:__

* DynamoDB Table resource exists in a CloudFormation stack and is deployed to a region.
* Running `cdk diff` shows no differences between cdk code and the deployed stack.
* Any table references in another resource are removed. This is required since we will
be deleting the table cdk code for migration.

__Steps:__

1. Set `removalPolicy` for your dynamodb table as `RETAIN` and deploy your code using `cdk deploy`.

  ```typescript
  const table = new Table(tableStack, 'FooStack', {
    tableName: 'FooGlobalTable',
    partitionKey: {
      name: 'FooHashKey',
      type: AttributeType.STRING,
    },
  });
  table.applyRemovalPolicy(RemovalPolicy.RETAIN);
  ```

2. After the prior deployment is successful, you can now remove the table from your CDK code and
deploy again. Since the retention policy is set to `RETAIN`, this will just disassociate the
resource from your CloudFormation stack.
3. Once prior deployment is successful, you can now import the existing table as a GlobalTable in
your CDK code. You can do this by using `from` methods like, `fromTableArn`, `fromTableName` or
`fromTableAttributes`.

  ```typescript
  GlobalTable.fromTableName(tableStack, 'ImportedTable', 'FooGlobalTable');
  ```

### Is this a breaking change?

This is not a breaking change. This is adding functionality to CDK library.

### What alternative solutions did you consider?

#### Defaults for read and write capacity

In the proposed solution, if a user selects billing mode as provisioned,
then they will need to specify
values for read and write capacities. There are no defaults assigned in
this solution.

In my opinion, if a user is using the provisioned mode, then they must
make conscious decisions about what
the capacity should look like for the table and its replicas.

#### Kms key not created for customer managed keys

In the proposed solution, if a user specifies customer managed key as
their choice on encryption, then they
will need to specify a key for each replica.

Unlike the Table construct, I am not creating the KMS keys for the customers.
I believe customer is making a conscious decision of using such encryption
and should add relevant keys. Customers will also not be surprised with the added cost
of KMS infrastructure.

To mitigate customer pain in this scenario, we can use a
[multi region KMS key](https://docs.aws.amazon.com/kms/latest/developerguide/multi-region-keys-overview.html)
and provision that if none is present. This will mean provisioning separate stacks in replica regions
to host the replicated KMS keys.

### What are the drawbacks of this solution?

#### Code Redundancy and maintainance

This solution uses a lot of code that is shared with the Table construct. Even if we try to maximize the
code shared between Table and Global Table constructs, there will still be some repeated code in each of
these. This can lead to added maintenance load in the long run since an update to the repeated code in
one of construct probably will need to be reflected in other as well. If such an update is missed in one
of the construct, it can lead to customer pain.

### What is the high-level project plan?

After this RFC is approved, construct squad members can pickup the implementation for it.

### Are there any open issues that need to be addressed later?

#### Deprecating CloudFormation Custom Resource Global Table Support

Since L2 support will now be added that is using the CloudFormation resource, there is no need of the
custom resource solution. This should be deprecated and users must be informed of this change.

#### Deprecating Table construct

Since Global Tables cost the same as a single table in a region, and will also cause code redundancy
between the two constructs, it will make sense to deprecate the construct and recommend users to use the
Global Table construct instead.

#### MULTI_REGION_KEY support

After deprecating `CUSTOMER_MANAGED` encryption mode, one of the new alternative will be `KEY_ARNS` mode. In this
mode, the users are responsibile for creating the KMS keys, maintaining them and also adding ARNs to the global table
construct. This will add churn for the users.
An RFC can be done for finalizing user experience around provisioning multi region KMS keys. What this probably would
involve is creating a multi region KMS key for the user and also creating stacks with replicated KMS key in requested
regions.

## Appendix

### Difference between TableProps and GlobalTableProps

* __Table Props__

Props that are the same:

* `partitionKey: Attribute;`
* `sortKey?: Attribute;`
* `tableName?: string;`
* `contributorInsightsEnabled?: boolean;`
* `pointInTimeRecovery?: boolean;`
* `tableClass?: TableClass;`
* `billingMode?: BillingMode;`
* `timeToLiveAttribute?: string;`
* `stream?: StreamViewType;`
* `deletionProtection?: boolean;`
* `removalPolicy?: RemovalPolicy;`

Props that are different:

* `serverSideEncryption?: boolean;`
  * This property was already deprecated.
* `replicationRegions?: string[];`, `replicationTimeout?: Duration;`, and `waitForReplicationToFinish?: boolean;`
  * These are no longer needed since replication is managed by GlobalTable resource itself.
* `encryption?: TableEncryption;`
  * There are more encryption options for GlobalTable.
* `encryptionKey?: kms.IKey;`
  * This is present but will be needed on a per replica basis.
* `kinesisStream?: kinesis.IStream;`
  * This is present but will be needed on a per replica basis.
* `writeCapacity?: number;`
  * This is no longer just a number in Global Table. This is now an autoscaling
  configuration.
* `readCapacity?: number;`
  * This can be either be fixed capacity or an autoscaling configuration.

* __GlobalTable Props__

Props that are different:

* `write?: Capacity;` and `read?: Capacity;`
  * Write capacity if mentioned, needs to be `Capacity.autoscaled`. And read capacity
  can be `Capacity.fixed` or `Capacity.autoscaled`.
* `globalSecondaryIndex?: GlobalSecondaryIndexOptions[];` and `localSecondaryIndex?: LocalSecondaryIndexProps[];`
  * These are now available to be passed in via constructor too and not just by `add` methods.
* `replicas?: ReplicaTableOptions[];`
  * This is the new way of specifying replicas. User can specify certain configuration options for replicas.
  When a prop is undefined and is present on global table level, then that value is copied over. Hence keeping
  user input to a minimum.
    * User can specify:
      * `region: string;`
        * This is the only mandatory prop if a replica is defined. If none are defined, then
        one is added for the region stack is being deployed to.
      * `globalSecondaryIndexOptions?: ReplicaGSIOptions[];`
        * These are some options that can be specified for GSIs on a replica basis.
      * `encryptionKey?: string;`
        * This will be a KMS key arn which will be imported in the stack.
      * `contributorInsightsEnabled?: boolean;`
      * `deletionProtection?: boolean;`
      * `pointInTimeRecovery?: boolean;`
      * `tableClass?: TableClass;`
      * `read?: Capacity;`
      * `kinesisStream?: kinesis.IStream;`
      * `tags?: CfnTag[];`
* `encryption?: GlobalTableEncryption;`
  * `CUSTOMER_MANAGED` will be deprecated.
  * [NEW] `KEY_ARNS` option will now need users to pass in KMS key arns to the replicas and it will
  be their responsibility to manage these. These arns will be imported as KMS keys.
  * [NEW] `MULTI_REGION_KEY` option will provision a new multi region KMS key for the user and provision
  supporting stacks in mentioned regions.
* `tags?: CfnTag[];`
  * Users will be able to pass in tags for the resource.

### Sample CloudFormation template generated

The following is the CFN template generated for the following code,

```typescript
  new GlobalTable(stack, 'FooTable', {
    partitionKey: { name: 'Foo', type: AttributeType.STRING },
  });
```

The generated template is,

```json
{
  "Resources": {
      "FooTable97478A04": {
          "Type": "AWS::DynamoDB::GlobalTable",
          "Properties": {
              "AttributeDefinitions": [
                  {
                      "AttributeName": "Foo",
                      "AttributeType": "S"
                  }
              ],
              "KeySchema": [
                  {
                      "AttributeName": "Foo",
                      "KeyType": "HASH"
                  }
              ],
              "Replicas": [
                  {
                      "ContributorInsightsSpecification": {
                          "Enabled": false
                      },
                      "DeletionProtectionEnabled": false,
                      "GlobalSecondaryIndexes": [],
                      "Region": "us-west-2",
                      "TableClass": "STANDARD"
                  }
              ],
              "BillingMode": "PAY_PER_REQUEST",
              "SSESpecification": {
                  "SSEEnabled": false
              }
          },
          "UpdateReplacePolicy": "Retain",
          "DeletionPolicy": "Retain"
      }
  },
  "Parameters": {
      "BootstrapVersion": {
          "Type": "AWS::SSM::Parameter::Value<String>",
          "Default": "/cdk-bootstrap/hnb659fds/version",
          "Description": "Version of the CDK Bootstrap resources in this environment, automatically retrieved from SSM Parameter Store. [cdk:skip]"
      }
  },
  "Rules": {
      "CheckBootstrapVersion": {
          "Assertions": [
              {
                  "Assert": {
                      "Fn::Not": [
                          {
                              "Fn::Contains": [
                                  [
                                      "1",
                                      "2",
                                      "3",
                                      "4",
                                      "5"
                                  ],
                                  {
                                      "Ref": "BootstrapVersion"
                                  }
                              ]
                          }
                      ]
                  },
                  "AssertDescription": "CDK bootstrap stack version 6 required. Please run 'cdk bootstrap' with a recent version of the CDK CLI."
              }
          ]
      }
  }
}
```
