# ProjectName — js-yaml-sugars a small wrapper around js-yaml library.

## Table of contents

- [About](#about)
- [Quick start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [Development](#development)
- [Implementation Details](#implementation-details)
- [FAQ](#faq)

## About

This library extends usage of tags in YAML files,

## Implementation-details

Wrapper is devided into three main steps which are pre-load, load and post-load steps.

- In pre-load step user interact with classes that introduce very similar user interface as js-yaml, these classes capture the props (e.g. constrcut, kind and others) to pass them later to js-yaml loader. There is two types you can define. firstly is regular Types that are identical to js-yaml type. the other is called universal types that doesn't depend on the kind of data (scalar, sequence or mapping), also they are intended to not modify data directly other than modify node it-self (make it private and not appear in other final output, make it local to the file where it's definined only, or even anchor values from the same file or other files without need to use anchors & aliasis), also due to the fact that these types are kindless they can be chained (with some rules) as importing a value from another place and make it local to this file. But these two behaviors are not strict and user can has the option to manipulate data directly by creating custom universal types.
  Chaining of tags creates what is known as composite type in which each construct function of type is executed on data one by one with the same order in which they are defined.

- In loading step regex is used to capture all the composite tags. these tags then are devided and each type defined for a tag is pulled from the schema and there constrcut functions are chained according to order of defining creating one construct function which will be fed with the node's data. In fact internally constructor just returns a custom object that holds constructor function along with node's data and type from js-yaml with some identifiers to track if node is resolved (constructor function fired) or not yet, this structure is called Node tree.
  This behavior is added to allow "deffered execution" which makes some nodes not resolve until the rest of the tree which doesn't have "deffered execution" flag set to true. this is particularly important in some universal tags as "include" or "hook" which they will be skipped in the first resolve iteration through the tree, and after all other nodes resolve they will execute the same constructor function of targets to get there values.
  You can also make universal tags return specific symbol named "NODE_DESTROY_SYMBOL", from its name if it's returned from a node this node will be destroyed and removed from the tree.
  By using these two simple behviors you can make complex behaviors like make first node definition private (deleted from output YAML) but all the anchors to it reserved. by making private tag return destroy symol only in the first construcor execution and making anchor method (e.g. hook) deffered. the first resolve iteration constructor returns destroy symbol so definition is removed then second execution by hook returns the acutal value so all anchors are present.
  If you read different YAMLs during one execution of load (e.g. Include tag that runs load() function inside the contructor) the Wrapper is optimized to cache Node tree of read files and any load() execution inside tags constructor will return the node tree directly if YAML text is the same and you can access it and execute the constructor of some nodes as needed (See Inlcude code example).
  Lastly you can add a context which is a way to pass external data through load() to the tag constructor, mainly it's used to control specific behaviors of the tag if needed (decide if private should retrun the anchored nodes or delete them as well). see "private", "local", "hook" and "include" examples to get examples of how they are helpful.

- In post-load step function is used to iterate through Node tree two times (limited to two to reduce complexity as possible), in the first iteration it will execute all non-deffered node constructors creating what is called "PartiallyResolvedTree". then it will through Node Tree again and start resolvign the deffered nodes by calling there constructors and values returned will be added to the PartiallyResolvedTree to output our final tree.

In fact the usage of "deffered" execution should not be used in almost all use cases unless you trully need some nodes to "wait" until some other nodes to "get its value". which is the case in tags as hook and include. but any other use case just normal 100% predictable pattern "not deffered" is better. Also i added the node tree to be source of truth and both steps execute the constructor to allow ability to return different values based on number of execution if needed not just copy the output of first construct execution. this was particularly helpful in "local" and "private" tags.

Chainability:
the kindless nature and purpose of universal nodes makes them chainable. And it's okay as they are intended to modify node not the data inside (Node's data will not change if you added private tag or not and hook tag is meant to just copy other node). But you can create your own custom universal tags other than already bundles ones and there is nothing prevent you from modifying data across invocations (but ofcourse you will need to gracefully handle kinds inside your construcor). But its almost always better and clearer to make regular types for any tag that modifies data directly and use them one by one in your yaml file.

Finally if you find all of this confusing and want the simple type kind and construct you can just use avoid creating any universal tags and use already shipped tags "private", "local", "hook", "include" which covers most use cases. If you have any idea for a universal tag that can add to the syntax and make code YAML code simpler and more maintainable contact us.
