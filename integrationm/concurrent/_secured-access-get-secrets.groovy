
def definition = argsMap["definition"]
def refField = argsMap["refField"]
def refInstanceId = argsMap["refInstanceId"]
def fields = argsMap["fields"]

if (definition == null ||
        refField == null ||
        refInstanceId == null ||
        (fields == null || fields.isEmpty())) {
    return json(400, [error: "Missing required parameters"])
}

def readResult = recordm.get(refInstanceId, argsMap.user)
if (!readResult.success() && readResult.getStatus() == 403) {
    return json(403, [forbidden: true])
}

def secrets = [:]

def query = "${refField.toLowerCase().replaceAll(" ", "_")}.raw:${refInstanceId}"
def results = recordm.search(definition, query, [size: 1])
if (results.getTotal() > 0) {
    def hit = results.getHits().get(0)
    fields.each { it -> secrets[it] = hit.value(it) }
}

recordm.create("Secured Access Audit", [
        "Access Date": "${System.currentTimeMillis()}",
        "Instance": "${refInstanceId}",
        "User": "${userm.getUser(argsMap.user).getBody()._links.self}",
        "Information Accessed": fields.join("\n")
])

return json(200, [secrets: secrets])