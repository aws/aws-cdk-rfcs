# Construct Hub Deny List

* **Original Author(s):**: @eladb
* **Tracking Issue**: #359
* **API Bar Raiser**: @RomainMuller

To ensure the integrity of the website and prevent recurring abuse we need to have the ability to block specific packages from being ingested.

## Working Backwards - README

The Construct Hub has a capability to block specific package versions (or all versions of a specific package) by 
adding it to a "deny list". When a package is in a deny list, its processing will be skipped be the ingestion 
pipeline (to protect the pipeline from abuse) and will no longer be available in the construct hub index or package pages.

To add a package to the deny list, add it to the `denyList` option when defining the `ConstructHub` construct in your deployment:

```ts
new ConstructHub(this, 'ConstrucHub', {
  denyList: {
    '@aws-cdk/aws-eks@1.44.0': {
      reason: 'Security issue.',
      user: 'eladb',
      date: new Date('2021-07-11T12:57:48.693Z'),
      ref: 'T123333322',
    },
    'boombam', {
      reason: 'Copyright violation',
      user: 'theadmin',
      date: new Date('2033-07-11T12:57:48.693Z'),
      ref: 'T137838738383',
    },
  }
});
```

The keys are package names and may also include specific version numbers.
If a version is not specified (e.g.`boombam`), then all versions of a specific module are denied. 
The value of each entry includes metadata which will be emitted in the ingestion log and in the future displayed in the 
"where is my package" page for publisher diagnostics.

```ts
interface DenyListEntry {
  /** The reason why this package/version is denied */
  readonly reason?: string;
  
  /** The user name that signed-off on the deny list entry */
  readonly user?: string;
  
  /** The time this package was added */
  readonly date?: Date;
  
  /** An internal reference to an issue or ticket that tracks this deny list entry */
  readonly ref: string;
}
```

The only required field is `ref` as in some cases it won't be possible to publish information
about a deny list entry, but we need some way to track it internally.

---

Ticking the box below indicates that the public API of this RFC has been
signed-off by the API bar raiser (the `api-approved` label was applied to the
RFC pull request):

```
[ ] Signed-off by API Bar Raiser @xxxxx
```

## Public FAQ


### What are we launching today?

A feature of the Construct Hub to allow operators to block packages (or package versions) from
appearing in search results and package pages.

### Why should I use this feature?

Operators (incl. Amazon, as the operator of the public construct hub) can use this to block
packages for any reason (e.g. security, compliance, copyright, trademark, etc).

## Internal FAQ

### Why are we doing this?

This is a security and legal requirement for the Construct Hub.

### What is the technical solution (design) of this feature?

The deny list will be modeled through strongly-typed API of the `ConstructHub`.

1. During deployment, we will use `BucketDeployment` in order to upload this list into a file in an S3 bucket.
2. We will trigger a lambda function every time the deny list file is created/updated. This lambda function will 
   iterate over the packages in the deny list and will delete any objects from the packages s3 bucket that match a 
   denied package. The object key prefix will be based on the deny entry key (name + version or just name). 
   We currently assume this process will fit into a single lambda execution given we will issue an S3 ListObjects 
   with a prefix filter. Timeout alarms will let us know if this does not scale and requires an additional indirection.
3. The "discovery" and "ingestion" lambda functions will retrieve this file for each request, and will consult the 
   deny list for every package. If an incoming package is in the deny list, it will be skipped and a log entry will 
   be emitted with the deny information.
4. The "inventory" process will retrieve the deny list and will emit a metric that includes the number of deny
   list entries in the list for monitoring purposes.
6. We will add a trigger to the "catalog-builder" for object deletion so when a denied package is deleted from 
   the packages bucket, the catalog will be rebuilt without that package.

### Is this a breaking change?

No.

### What alternative solutions did you consider?

#### Manually manage the deny list via a file on S3

We considered the option of letting operators manage their deny list by directly editing a file on S3. There are multiple downsides to this approach:

1. If this file gets corrupted due to a human error (e.g. invalid JSON), denied package may be ingested. 
   To address this we would need some kind of fallback to previously good versions and this adds quite a 
   lot of unneeded complexity. By defining the deny list in strongly-typed code, the compiler (and synthesizer) 
   takes care of validating the input which simplifies downstream consumption of this information.
3. Each deployment will have its own copy of the deny list and replicating the deny list across multiple 
   environments (e.g. gamma/prod) will require additional mechanism. By allowing users to specify deny list 
   in code, they have freedom to decide what parts of the list is replicated across environments (all/none/partial) 
   by using simple programming techniques (e.g. constants).


### What are the drawbacks of this solution?

One benefit of the direct S3 approach is reduced SLA for blocking a package. In the proposed design, customers need to 
commit the change to their source repository and have that change propagate through their release pipeline in order for
the package to be removed. But since the SLA we declared for removing a package is 48 hours, this seems like a reasonable
tradeoff. If in the future we will want to add support for "quick removal" we can always add an additional mechanism that
will temporarily block a package.

Another potential drawback (albeit it could be preceived as a feature) is that packages denied in the public hub (or any 
hub instance for that matter) will still be allowed in other hubs until they are explicitly 
added to the deny list there. That might actually be the desired behavior (e.g. local deployment may 
want to show a package that is blocked in the public hub), but it should be communicated that if a 
package is reported and denied from the public hub, it will still appear in private hubs unless it is 
explicitly denied there.

### What is the high level implementation plan?

- [ ] Add `denyList` option to `ConstructHub` and upload to an S3 bucket.
- [ ] Filter denied packages in "discovery"
- [ ] Filter denied packages in "ingestion"
- [ ] Add deny list count to "inventory"
- [ ] Create deny-list handler - triggered by updates to the deny list and deletes existing packages
- [ ] Update catalog builder when objects are deleted
- [ ] Move "report abuse" email address to `ConstructHub` API so it's configurable in private instances
- [ ] Update documentation to indicate that deny list (and report abuse) is instance-specific

### Are there any open issues that need to be addressed later?

* [ ] @NetaNir can you elaborate on this please? "(Security-requirement) "Alert when a specific package owner 
      is hitting the deny list protection far more then normal."
