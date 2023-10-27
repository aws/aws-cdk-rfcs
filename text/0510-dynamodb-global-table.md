# AWS DynamoDB Global Table L2 Construct

* **Original Author(s):**: @vinayak-kukreja
* **Tracking Issue**: #510
* **API Bar Raiser**: @rix0rrr

Users will now be able to replicate their DynamoDB table to multiple regions using the Global Table L2 construct.
This feature will be using the CloudFormation resource for global table and users will no longer need to rely on
custom resources for provisioning global tables.

## Working Backwards

The following is ReadMe for DynamoDB Global Table.

__NOTE:__ This just includes properties that are different from the Table construct. For an in detailed comparison
between properties, take a look at the [appendix](#difference-between-tableprops-and-globaltableprops).

### DynamoDB Global Table

[DynamoDB Global Table](https://aws.amazon.com/dynamodb/global-tables/) lets you provision a table that can be
replicated across different regions. It can also be deployed to just one region and will cost the same as a
single DynamoDB table.

It is also multi-active database, that means there is no primary table and all the tables created are called
as replicas and all replicas support both reads and writes. Writes to a replica are eventually propagated to other
replicas where conflicts are resolved by 'last writer wins'.

#### Read and Write Capacity

Global tables by default have billing mode as "on-demand". If you choose the billing mode as "provisioned",
then you will need to specify read and write capacities. If these values are specified at global table level, then
those values are used for each replica.

```typescript
new GlobalTable(tableStack, 'GlobalTable', {
  tableName: 'FooTable',
  partitionKey: {
    name: 'FooHashKey',
    type: AttributeType.STRING,
  },
  billingMode: BillingMode.provisioned({
    writeCapacity: Capacity.autoscaled({ max: 70 }),
    readCapacity: Capacity.fixed(20),
  }),
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

For instance, the following will create a replica in `us-west-2`(stack's region), `us-east-1` and `us-east-2`.

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
* `kinesisStream` --> This needs to be defined per replica
* `globalSecondaryIndexOptions`
  * `indexName` --> Needs to be specified
  * `contributorInsightsEnabled` --> Gets copied over from global table level props or replica level props if defined.
  * `read` --> Gets copied over from table level GSI props.

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
  billingMode: BillingMode.provisioned({
    writeCapacity: Capacity.autoscaled({ max: 70 }),
    readCapacity: Capacity.fixed(20),
  }),
  replicas: [
    {
      region: 'us-west-1',
      readCapacity: Capacity.autoscaled({ max: 60 }),
    },
    {
      region: 'us-east-2',
    },
  ],
});
```

__NOTE:__

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

* You only need to provide write capacity for GSIs where you want it to be different than the capacity specified
for the global table. If not specified, it uses the same value as that of the global table. But, you always need
to specify the read capacity for a GSI.

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
    billingMode: BillingMode.provisioned({
      writeCapacity: Capacity.autoscaled({ max: 70 }),
      readCapacity: Capacity.fixed(40),
    }),
    globalSecondaryIndex: [{
      indexName: 'UniqueGsiName',
      partitionKey: {
        name: 'FooRangeKey',
        type: AttributeType.STRING,
      },
      writeCapacity: Capacity.autoscaled({ max: 90 }),
      readCapacity: Capacity.autoscaled({ max: 60 }),
    }],
    replicas: [{
      region: 'us-east-1',
    }],
  });
  ```

* You can provide read capacity for GSIs within a replica where you want it to be different than the
GSI's read capacity specified at global table level.

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
    billingMode: BillingMode.provisioned({
      writeCapacity: Capacity.autoscaled({ max: 70 }),
      readCapacity: Capacity.autoscaled({ max: 50 }),
    }),
    globalSecondaryIndex: [{
      indexName: 'UniqueGsiName',
      partitionKey: {
        name: 'FooRangeKey',
        type: AttributeType.STRING,
      },
      readCapacity: Capacity.autoscaled({ max: 50 }),
    }],
    replicas: [{
      region: 'us-east-1',
      globalSecondaryIndexOptions: {
        'UniqueGsiName': {
          readCapacity: Capacity.fixed(55),
        },
      },
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
const globalTable = new GlobalTable(tableStack, 'FooTable', {
  tableName: 'FooTable',
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

Encryption defines how the table, replicas and GSIs would be encrypted at rest. There are now four
types of encryptions that are available for global tables:

1. `TableEncryption.dynamodbOwnedKey`: This uses a KMS key for encryption that is owned by DynamoDB. This is the default
for global tables.
2. `TableEncryption.awsManagedKey`: A KMS key is created in your account and is managed by AWS.
3. `TableEncryption.customerManagedKey`: You will need to provide a KMS key for the table and key arns for each replica.
The key also needs to be in the same region as the replica.
4. `TableEncryption.multiRegionKey`: [NEW] A multi region KMS key and its supporting stacks in replica regions will be
provisioned automatically.

The `encryption` mode selected remains the same for each replica. If you will like to provide KMS keys managed
by you for each replica, then you can use `customerManagedKey` and provide table and region specific keys.

```typescript
// Stack region: us-west-2. Table KMS key.
const tableKmsKey: kms.IKey = new kms.Key(tableStack, 'FooTableKey');

new GlobalTable(tableStack, 'FooTable', {
  tableName: 'FooGlobalTable',
  partitionKey: {
    name: 'FooHashKey',
    type: AttributeType.STRING,
  },
  encryption: TableEncryption.customerManagedKey(
    tableKmsKey,
    {
      // Replica KMS key arn
      'us-east-1': 'FooKeyArn',
    },
  ),
  replicas: [
    {
      region: 'us-east-1',
    },
  ],
});
```

#### Grants

To use one of the replicas in your application, you can use the replica's grant methods to get the necessary permissions.

The global table's `replica(region)` method will return an `ITable` reference of the replica from which you will be able
to grant permissions.

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
        },
        {
          region: 'us-east-1',
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

You can access a replica's emitted metrics by using `metric` methods. These metrics can be used to create dashboard
graphs or alarms.

The global table's `replica(region)` method will return an `ITable` reference of the replica from which you will be able
to get the specific metrics.

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

* Similar to CloudFormation, CDK only supports version
[2019.11.21](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/globaltables.V2.html) of the global table.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `status/api-approved` label was applied to the
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
You will no longer need to create custom solution for replicating your table to other regions and will also
decrease maintenance load.
* You want to import global tables using CloudFormation import.
* You want to use drift detection.
* You want to create replicated GSIs for an autoscaled table.

## Internal FAQ

### Why are we doing this?

DynamoDB Global Table L2 support has been requested by our users for a long time. When CDK initially added
support for this feature, CloudFormation support for global tables did not exist. So we had to use
[custom CloudFormation resources](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.custom_resources-readme.html)
within our [Table construct](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_dynamodb-readme.html#amazon-dynamodb-global-tables)
to add support for this feature.

The current implementation has some limitations,

* Some properties are not propagated across replicas.
  * Open Issues: #25740, #25443, #18582
* Customer managed key is not supported with replicationRegions in current solution.
(Issues: #15957)

The existing solution also will add maintenance load and cost for custom resource in user stack.
And also blocks users who do not want to use a custom resource solution for provisioning their global tables.

The proposed design does not use custom resources and aligns to the user experience that
global table intended to provide. With CloudFormation now having support for global table resource,
we can now add L2 support for this feature.

### Why should we _not_ do this?

We currently offer two solution to provision a global table,

1. Custom CloudFormation Resource within Table construct
2. L1 for global table resource

This means the customer is not blocked to use global tables. Adding L2 support will take up developer
time and effort and, will also add to maintenance load for the CDK team.

### What is the technical solution (design) of this feature?

#### Replicas

The user will be able to specify list of replicas using `replicas` properties. User will also be able to
add a single replica using the `addReplica` method.

* If a user just wants to deploy to the region where the stack is being deployed, then they will not need
to specify the replica until they want to configure certain properties of the replica.
* Properties that are mentioned at the global table level configuration gets copied over to all replicas
if user has left them undefined. If a certain property is defined on a replica level, then that takes
precedence over the global table level value. For instance,

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

  * `read?: Capacity` (This is defined with BillingMode at global table level)
  * `contributorInsightsEnabled?: boolean`
  * `deletionProtection?: boolean`
  * `pointInTimeRecovery?: boolean`
  * `tableClass?: TableClass`
  * `tags?: CfnTag[]`

#### BillingMode and Capacity

The capacity values will only be needed to be specified if the billing mode is provisioned. By default,
the mode will be on-demand. If the billing mode is provisioned, then each capacity needs to be specified
since we are not choosing defaults for the users.

The write capacity for table, replicas or GSIs can only be specified with an autoscaling configuration.
Whereas, the read capacity can either be with a fixed capacity unit or with an autoscaling configuration.

Capacity(enum like class):

* `Capacity.fixed(number)`
* `Capacity.autoscaled({ configuration })`

```typescript
readCapacity: Capacity.fixed(20)
```

BillingMode(enum like class):

* `BillingMode.provisioned(({ configuration }))`
* `BillingMode.ondemand()`

```typescript
billingMode: BillingMode.provisioned({
  writeCapacity: Capacity.autoscaled({ max: 70 }),
  readCapacity: Capacity.fixed(20),
}),
```

Another way of defining the capacity can be,

```typescript
new GlobalTable(tableStack, 'GlobalTable', {
  tableName: 'FooTable',
  partitionKey: {
    name: 'FooHashKey',
    type: AttributeType.STRING,
  },
  billingMode: BillingMode.PROVISIONED,
  writeCapacity: Capacity.autoscaled({ max: 70 }),
  readCapacity: Capacity.fixed(20),
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

Here, the `billingMode`, `writeCapacity` and `readCapacity` are different props. The reasons for using enum like
classes over this implementation are,

* It conveys intent to the users in a better way. For instance, it only makes sense to add capacity values if the
billing mode is provisioned. If not using the enum like classes, then we can have something like this,

  ```typescript
  {
    ...
    billingMode: BillingMode.ON_DEMAND,
    writeCapacity: Capacity.autoscaled({ max: 70 }),
    readCapacity: Capacity.fixed(20),
    ...
  }
  ```

  This does not make sense as we are adding capacity even when the billing mode is on-demand. We can add validation
  around this, but, it is much cleaner to do this with the enum like class.
* It reduces the number of validation we will have to add for the three properties. For instance, another scenario
can be if a user sets the `billingMode: BillingMode.PROVISIONED` but does not set any capacity values. We will need
to add validations around this case but, with an enum like class here, we will not need such validation since user
will need to pass in configuration like `BillingMode.provisioned(({ configuration }))`.

To ease the user experience, this API will copy over values where undefined.
The following explains how this works for each,

* __Table__
  User can assign read and write capacity at global table level props and these will be used for each replica.
  And, if the user wants, they can change read capacity value for replica and that will take precedence over
  global table level read capacity.

  Unlike replicas, for the GSIs only write capacity of the global table will be copied. The user will need
  to specify read capacity for a GSI. If they also mention the read capacity for a GSI in a replica, then that
  value will take precedence.

  For instance,

  ```typescript
  new GlobalTable(tableStack, 'GlobalTable', {
    tableName: 'FooTable',
    billingMode: BillingMode.provisioned({
      writeCapacity: Capacity.autoscaled({ max: 70 }),
      readCapacity: Capacity.fixed(20),
    }),
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
      readCapacity: Capacity.fixed(10),
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
  table level props. And `readCapacity: Capacity.fixed(10),` is specified for a GSI and write capacity will be
  the same as the table since not defined in the GSI.

* __Replicas__
  User can choose to assign capacity values for each replica. They will still need to specify "write" and "read" capacity
  at the global table level. But, they will be able to override "read" capacity per replica.

  ```typescript
  new GlobalTable(tableStack, 'GlobalTable', {
    tableName: 'FooTable',
    billingMode: BillingMode.provisioned({
      writeCapacity: Capacity.autoscaled({ max: 70 }),
      readCapacity: Capacity.autoscaled({ max: 50 }),
    }),
    partitionKey: {
      name: 'FooHashKey',
      type: AttributeType.STRING,
    },
    replicas: [
      {
        region: 'us-west-2',
        readCapacity: Capacity.fixed(15),
      },
      {
        region: 'us-east-1',
      },
    ],
  });
  ```

  Here, `write: Capacity.autoscaled({ max: 70 })` is defined and will be the same for each replica. And,
  read capacity is defined for `us-west-2` as `Capacity.fixed(15)` and for `us-east-1` it will just use
  the global table level capacity, i.e., `Capacity.autoscaled({ max: 50 })`.

* __Global Secondary Indexes__
  There are multiple ways to define GSI capacity values.

  For only writes,

  * A user can specify value at global table level props. This is mentioned in the prior section for tables.

  For reads and writes,

  * A user can specify value in global secondary index props at global table level.

    ```typescript
    new GlobalTable(tableStack, 'GlobalTable', {
      tableName: 'FooTable',
      billingMode: BillingMode.provisioned({
        writeCapacity: Capacity.autoscaled({ max: 70 }),
        readCapacity: Capacity.autoscaled({ max: 50 }),
      }),
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
        writeCapacity: Capacity.autoscaled({ max: 90 }),
        readCapacity: Capacity.fixed(16),
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
    be used by `UniqueGsiName` GSI.

    If both `write` capacity are specified, the precedence will be

    ```
    GSI write capacity at global table level  <---- Write capacity at global table level
    ```

  For only reads,

  * A user can specify value at replica level GSI props.

    ```typescript
    new GlobalTable(tableStack, 'GlobalTable', {
      tableName: 'FooTable',
      billingMode: BillingMode.provisioned({
        writeCapacity: Capacity.autoscaled({ max: 70 }),
        readCapacity: Capacity.autoscaled({ max: 50 }),
      }),
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
        readCapacity: Capacity.autoscaled({ max: 20 }),
      }],
      replicas: [
        {
          region: 'us-east-1',
          globalSecondaryIndexOptions: {
            'UniqueGsiName': {
              readCapacity: Capacity.fixed(10),
            },
          },
        },
        {
          region: 'us-west-2',
        },
      ],
    });
    ```

    Here, the `read` capacity for `UniqueGsiName` is defined at two places, one at the global
    table level and the other in `us-east-1` replica. Now, the capacity defined in the replica
    for `us-east-1` will take precedence over the value defined at global table level.
    But, for replica `us-west-2`, since no replica specific GSI read capacity is defined, so it
    will use the value defined at table level.

    The `write` capacity for the `UniqueGsiName` in each replica will be `writeCapacity: Capacity.autoscaled({ max: 70 })`
    since no value is specified in the GSI configuration itself at table level.

    If readCapacity is provided at both places, then the precedence will be

    ```
    GSI read capacity defined at replica level <---- GSI read capacity defined at global table level
    ```

#### Per-replica KMS keys

Global table offers users to specify user owned KMS keys for table and its replicas. The user will need to define
these keys for the table and each replica. And, global table requires keys to be present in-region of the replica.

Instead of the enum being used in Table construct, we will be switching to an enum like class `TableEncryption`. It would
initially support, `dynamodbOwnedKey`, `awsManagedKey` and `customerManagedKey`. And, support for `multiRegionKey` would be
added later.

* `TableEncryption.dynamodbOwnedKey()` --> Default
* `TableEncryption.awsManagedKey()`
* `TableEncryption.customerManagedKey(tableKey: IKey, replicaKeyArns?: { [region: string]: string})`
* `TableEncryption.multiRegionKey()`

* `customerManagedKey` option is updated, where the user can mention the KMS key for the table and KMS key arns for replicas
and we will import these to the user stack.

  ```typescript
  const app = new App();

  const tableStack = new Stack(app, 'GlobalTableStack', {
    env: {
      region: 'us-west-2',
    },
  });

  // Table(us-west-2) KMS key
  const tableKmsKey: kms.IKey = new kms.Key(tableStack, 'FooTableKey');

  new GlobalTable(tableStack, 'FooTable', {
    tableName: 'FooGlobalTable',
    partitionKey: {
      name: 'FooHashKey',
      type: AttributeType.STRING,
    },
    encryption: TableEncryption.customerManagedKey(
      tableKmsKey,
      {
        // us-east-1 replica KMS key
        'us-east-1': 'FooKeyArn',
      },
    ),
    replicas: [
      {
        region: 'us-east-1',
      },
    ],
  });
  ```

* A new option will be introduced: `multiRegionKey`. This will be a multi region KMS key that we provision
for the customer and will also provision the supporting stacks in regions where a table replica is present.
This feature probably requires an RFC of its own and can be added at a later point after release.

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
          },
          {
            region: 'us-east-1',
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

  Here, global table defined is `FooStack` has two replica regions. Here, `us-west-2` is the region
  stack is being deployed to. The `BarStack` stack props accepts an `ITable` and provides needed permissions to the IAM user defined
  in the stack. During initialization, the global table replica method `fooStack.globalTable.replica('us-east-1')`
  passes in the ITable reference for `us-east-1` replica. And, the iam user only gets access to reads for
  that `us-east-1` replica.

  __Callouts__:

* For table references, `tableName` property can be mandated for constructing arns for replicas. If not mandated to
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
* Any table references in other resources are removed. This is required since we will
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
the capacity should look like for the table, replicas and GSIs.

#### Kms key not created for customer managed keys

In the proposed solution, if a user specifies customer managed key as
their choice of encryption, then they will need to specify a key for the table and
KMS key arns for each replica.

Unlike the Table construct, I am not creating the KMS keys for the customers.
I believe customer is making a conscious decision of using such encryption
and should add relevant keys. Customers will also not be surprised with the added cost
of KMS infrastructure.

To mitigate customer pain in this scenario, we can use a
[multi region KMS key](https://docs.aws.amazon.com/kms/latest/developerguide/multi-region-keys-overview.html)
and provision that if none is present. This will mean provisioning separate stacks in replica regions
to host the replicated KMS keys.

### What are the drawbacks of this solution?

#### Code Redundancy and maintenance

This solution uses a lot of code that is shared with the Table construct. Even if we try to maximize the
code shared between Table and Global Table constructs, there will still be some repeated code in each of
these. This can lead to added maintenance load in the long run since an update to the repeated code in
one of construct probably will need to be reflected in other as well. If such an update is missed in one
of the construct, it can lead to customer impact.

### What is the high-level project plan?

After this RFC is approved, construct squad members can pickup the implementation.

### Are there any open issues that need to be addressed later?

#### Deprecating CloudFormation Custom Resource Global Table Support

Since L2 support will now be added that is using the CloudFormation resource, there is no need of the
custom resource solution. This should be deprecated and users must be informed of this change.

#### Deprecating Table construct

Since Global Tables cost the same as a single table in a region, and will also cause code redundancy
between the two constructs, it will make sense to deprecate the construct and recommend users to use the
Global Table construct instead.

#### MULTI_REGION_KEY support

An RFC can be created for finalizing user experience for provisioning multi region KMS keys. What this probably will
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
  * This is removed and keys instead will be needed on a per replica basis in encryption property.
* `kinesisStream?: kinesis.IStream;`
  * This is present but will be needed on a per replica basis.
* `writeCapacity?: number;`
  * This is no longer just a number in Global Table. This is now an autoscaling
  configuration.
* `readCapacity?: number;`
  * This can be either be fixed capacity or an autoscaling configuration.
* `billingMode?: BillingMode;`
  * This will now be an enum like class instead of an enum.

* __GlobalTable Props__

Props that are different:

* `writeCapacity?: Capacity;` and `readCapacity?: Capacity;`
  * Write capacity if mentioned, needs to be `Capacity.autoscaled`. And read capacity
  can be `Capacity.fixed` or `Capacity.autoscaled`.
* `globalSecondaryIndex?: GlobalSecondaryIndexProps[];` and `localSecondaryIndex?: LocalSecondaryIndexProps[];`
  * These are now available to be passed in via constructor too and not just by `add` methods.
* `replicas?: ReplicaTableOptions[];`
  * This is the new way of specifying replicas. User can specify certain configuration options for replicas.
  When a prop is undefined and is present on global table level, then that value is copied over. Hence keeping
  user input to a minimum.
    * User can specify:
      * `region: string;`
        * This is the only mandatory prop if a replica is defined. If none are defined, then
        one is added for the region stack is being deployed to.
      * `globalSecondaryIndexOptions?: ReplicaGSIOptions;`
        * These are some options that can be specified for GSIs on a replica basis.
      * `contributorInsightsEnabled?: boolean;`
      * `deletionProtection?: boolean;`
      * `pointInTimeRecovery?: boolean;`
      * `tableClass?: TableClass;`
      * `read?: Capacity;`
      * `kinesisStream?: kinesis.IStream;`
      * `tags?: CfnTag[];`
* `encryption?: TableEncryption;`
  * Will change to an enum like class from an enum.
  * `customerManaged` will be updated to support table and replica keys.
  * [NEW] `multiRegionKey` option will provision a new multi region KMS key for the user and provision
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
