def instanceId = argsMap["instanceId"]
def securedFieldDefId = argsMap["securedFieldDefId"]
def fields = argsMap["fields"]

if (instanceId == null ||
        securedFieldDefId == null ||
        (fields == null || fields.isEmpty())) {
    return json(400, [error: "Missing required parameters"])
}

// The user must have access to the source instance in order for it to see secured information in the referred instance
def rmInstanceReadResult = recordm.get(instanceId, argsMap.user)
if (!rmInstanceReadResult.success() && rmInstanceReadResult.getStatus() == 403) {
    return json(403, ["error": "forbidden"])
}

def definitionResponse = recordm.getDefinition(rmInstanceReadResult.getBody().jsonDefinition.name)
def definition = definitionResponse.getBody()
if (definition == null) {
    return json(400, ["error": "Definition not found"])
}

def securedFieldConfiguration = definition.getField(securedFieldDefId.toInteger()).getConfiguration()
if (securedFieldConfiguration == null) {
    return json(400, ["error": "Secured field definition not found"])
}

// If the secured field group has a $restricted then the user must belong to one of the groups
def user = userm.getUser(argsMap.user).getBody()

if (securedFieldConfiguration != null && securedFieldConfiguration.contains("Restricted")) {
    def args = securedFieldConfiguration.getArgsFor("Restricted").args
    if (Collections.disjoint(args as List, user.groups.collect { it.name })) {
        return json(403, ["error": "forbidden"])
    }
}

def securedAccessConf = securedFieldConfiguration.getArgsFor("\$securedAccess").args
def targetDefinition = securedAccessConf?.get(0)
def targetField = securedAccessConf?.get(1)

if (targetDefinition == null || targetField == null) {
    return json(400, ["error": "Bad configuration"])
}

def secrets = [:]

def query = "${targetField.toLowerCase().replaceAll(" ", "_")}.raw:${instanceId}"
def results = recordm.search(targetDefinition, query, [size: 1])
def securedInstanceId
if (results.getTotal() > 0) {
    def hit = results.getHits().get(0)
    securedInstanceId = hit.getId()
    fields.each { it -> secrets[it] = hit.value(it) }
}

recordm.create("Secured Access Audit", [
        "Access Date"         : "${System.currentTimeMillis()}",
        "User"                : "${user._links.self}",
        "Instance"            : "${instanceId}",
        "Secured Instance"    : "${securedInstanceId}",
        "Definition"          : "${targetDefinition}",
        "Information Accessed": fields.join("\n"),
])

return json(200, [secrets: secrets])