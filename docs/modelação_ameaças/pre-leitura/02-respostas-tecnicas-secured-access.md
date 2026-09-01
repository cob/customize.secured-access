# Pré-leitura 2 de 2 — Respostas às dúvidas técnicas

> **Ler antes da reunião** (~10 min). São as respostas escritas às seis dúvidas técnicas do ponto 2 da agenda, retiradas da leitura do código (FE `_secured_access.js`, BE `_secured-access-get-secrets.groovy`). Levá-las respondidas à sessão é o que permite fazer a modelação em 60m. Cada resposta descreve **o que o código faz hoje**, com a referência à linha; a classificação de risco e as mitigações ficam para a sessão.
>
> No fim há uma lista de **pontos que vão surgir no brainstorming** — factos do código que merecem atenção, sem os pré-classificar.

---

## 1. Onde acontece o mascaramento? O valor em claro segue na resposta inicial ou só depois da revelação?

**Só depois da revelação.** Ao abrir a instância, o FE constrói localmente caixas com a constante `HIDDEN_VALUE = "************"` (FE:5, FE:54–59) e **não faz nenhum pedido de segredos**. O valor em claro só circula na resposta ao `POST` de revelação, quando o utilizador carrega no olho (`getSecret` → endpoint, FE:70/101–125; BE devolve `secrets`, BE:66).

Consequência: abrir, imprimir ou partilhar o ecrã de uma instância **por si só** não expõe os valores — desde que ninguém tenha revelado. Depois de revelado, o valor fica na propriedade `value` do input no DOM até se voltar a esconder (FE:75–77, 91).

## 2. Em que contexto de permissões corre a resolução? As permissões da definição segura são avaliadas?

Há **três verificações com contextos diferentes**:

- **Instância de origem — no contexto do utilizador.** `recordm.get(instanceId, argsMap.user)`; se der 403, o endpoint devolve `forbidden` (BE:12–15). Ou seja, o utilizador tem de conseguir ler a instância que envolve o bloco seguro.
- **`$restricted` no grupo — no contexto do utilizador.** Se a configuração do grupo tiver `$restricted`, verifica se o utilizador pertence a um dos grupos (BE:29–36).
- **Leitura da definição segura — NÃO no contexto do utilizador.** A procura da instância segura e a leitura dos campos correm sem o argumento de utilizador: `recordm.search(targetDefinition, query, [size: 1])` (BE:49) e `hit.value(it)` (BE:54). Não é passado `argsMap.user`, pelo que **as permissões próprias da definição segura não são avaliadas nesta leitura indirecta**, nem há verificação por campo.

Resposta curta: o acesso é decidido por (a) ler a instância de origem **e** (b) opcionalmente o `$restricted` do grupo. As permissões da *definição segura* em si **não entram** no caminho de revelação.

## 3. Quem pode declarar `$securedAccess()` e contra que definições? Existe validação?

**Não é respondido por estes dois ficheiros** — é configuração de definição/plataforma RecordM. O que o código faz:

- Valida a **forma** da configuração, não a autorização: o FE mostra erro se `args.length <= 1` (FE:20–23) ou se um `$securedInfo` não tiver exactamente 1 argumento (FE:45–48); o BE devolve 400 se faltar definição/campo alvo (BE:42–44).
- **Não há**, no caminho de execução, qualquer verificação de que o modelador que declarou `$securedAccess(<def>, <campo>)` tinha acesso à definição alvo. Combinado com a resposta 2 (a leitura corre em contexto de sistema), fica em aberto o cenário de *confused deputy* em tempo de configuração — a confirmar com quem conhece o controlo de acesso ao modelo de dados.

## 4. Semântica do matching: 0, 2+ instâncias, referências re-apontadas?

A resolução é uma pesquisa `"<campo_de_referência>.raw:<instanceId>"` com `size: 1`, que usa **a primeira ocorrência** (BE:48–55):

- **0 ocorrências:** `securedInstanceId` fica `null`, `secrets` fica vazio `{}`; o FE porá `undefined` nas caixas. **A auditoria é escrita à mesma**, com instância segura a `null` (BE:57–64).
- **2+ ocorrências:** usa **silenciosamente a primeira** (ordem de pesquisa), ignorando as restantes — qual instância segura é devolvida não é determinístico se houver mais do que uma a apontar para a mesma origem.
- **Referência re-apontada:** é devolvida a instância segura que, no momento, tiver `<campo de referência>.raw == instanceId`. Mudar esse campo de referência muda o que aparece.

## 5. O que fica no registo de auditoria? O valor em claro é registado?

Um registo `Secured Access Audit` por revelação (BE:57–64) com: **Access Date** (timestamp em ms), **User** (`user._links.self`), **Instance** (id de origem), **Secured Instance** (id, ou `null`), **Definition** (nome da definição segura) e **Information Accessed** (os **nomes** dos campos, um por linha).

**O valor em claro não é registado** — só os nomes dos campos. Ponto a reter para a sessão: a revelação **não depende do sucesso da auditoria** — o `recordm.create(...)` da auditoria não é verificado e os `secrets` são devolvidos a seguir de qualquer forma (BE:57–66).

## 6. Configuração inválida: falha aberta ou fechada?

Para a *forma* da configuração, **falha fechada**:

- FE: instância nova ou edição de grupo → "não disponível", sem botão (FE:13–16); `args` insuficientes → mensagem de erro, sem botão (FE:20–23); `$securedInfo` mal configurado → erro no campo (FE:45–48).
- BE: parâmetros em falta → 400 (BE:5–9); definição/campo alvo em falta → 400 (BE:42–44); configuração do campo não encontrada → 400 (BE:23–26).

Um ponto a **confirmar** (candidato a falha aberta): o `$restricted` do grupo é detectado por `securedFieldConfiguration.contains("Restricted")` e lido por `getArgsFor("Restricted")` (BE:31–32), enquanto o `$securedAccess` é lido por `getArgsFor("\$securedAccess")` (BE:38). É preciso confirmar qual é a chave exacta com que o `$restricted` fica registado na configuração — se não corresponder a `"Restricted"`, a verificação de grupos é silenciosamente saltada e o gate de `$restricted` **falha aberto**.

---

## Pontos que devem surgir no brainstorming (factos, sem pré-classificar)

Identificados a partir do código; na sessão decidimos se são ameaça e com que gravidade.

1. **O endpoint aceita `fields` arbitrários.** O BE lê exactamente os campos que vêm no pedido (`fields.each { secrets[it] = hit.value(it) }`, BE:54) e **não confirma** que são os campos declarados com `$securedInfo` sob o grupo. O FE só envia os declarados (FE:36–62, 73), mas o endpoint é chamável directamente — ver ponto 4. *(Categoria provável: Information Disclosure / Elevation of Privilege.)*
2. **A leitura da definição segura corre em contexto de sistema** (resposta 2). Ler a instância de origem passa a dar, na prática, acesso de leitura aos campos da instância segura ligada, independentemente das permissões da definição segura — salvo o `$restricted` do grupo (cujo match convém confirmar, resposta 6).
3. **`$restricted` — chave da configuração a confirmar** (resposta 6): se não casar, o único gate específico do grupo desaparece sem erro.
4. **Endpoint chamável directamente.** É um `fetch` para `/integrationm/concurrent/_secured-access-get-secrets` (FE:105); qualquer utilizador autenticado o pode invocar fora da UI, escolhendo `instanceId`, `securedFieldDefId` e `fields` — o que torna alcançáveis os pontos 1 e 2.
5. **Revelação independente da auditoria** (resposta 5): os `secrets` são devolvidos mesmo que a escrita da auditoria falhe ou que a definição de auditoria não exista. *(Categoria provável: Repudiation.)*
6. **Sem rate limiting visível.** Cada clique/pedido é uma leitura + um registo de auditoria; chamadas em script permitem revelação em massa e crescimento do registo de auditoria. *(Categoria provável: Denial of Service / Information Disclosure.)*
7. **`instanceId` interpolado na query de pesquisa** (BE:48). Passa antes por `recordm.get(instanceId)`, o que provavelmente o obriga a ser um id válido; confirmar que está limitado a numérico, para descartar injecção no termo `.raw:`.
8. **Valor revelado vive no DOM** (FE:75–77) até nova ocultação; imprimir, capturar ecrã ou inspeccionar depois de revelar expõe-no. Em grande parte é o comportamento assumido por desenho, mas notar preenchimento automático do browser / extensões.
