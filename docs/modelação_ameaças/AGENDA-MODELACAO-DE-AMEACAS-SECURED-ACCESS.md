# Modelação de Ameaças — `$securedAccess()` (Campos Seguros)

> **Feature em análise:** o par de keywords `$securedAccess()` / `$securedInfo()` do RecordM, que apresenta numa instância, mascarados e com revelação auditada, valores guardados numa definição separada com acesso controlado (ver `pt/.../11_customizations-keywords/14_secured-access.md`).
>
> **Duração total: 60m** - assume a preparação prévia (leitura dos anexos)

## Preparação prévia (obrigatória)

* Enviar aos participantes a página de documentação da keyword e o exemplo `Devices` / `Device Credentials`.
* Preparar o DFD com os três fluxos: configuração (declaração das keywords), apresentação (resolução pelo campo de referência) e revelação (olho riscado).
* Enviar ao dev as seis dúvidas técnicas do ponto 2, para resposta **por escrito** antes da reunião.
* Participantes: facilitador, dev(s) que conhecem a implementação da keyword no RecordM, um modelador/admin de soluções, segurança/produto.

### 1. Abertura e Contexto [5m]

* Objectivo: validar se `$securedAccess()` cumpre as garantias que promete e identificar riscos na sua implementação e na sua configuração pelos admins.
* Âmbito: as keywords `$securedAccess()`/`$securedInfo()` — resolução da instância segura, mascaramento, revelação e auditoria. Fora de âmbito: o motor de permissões do RecordM em geral e as restantes keywords (`$restricted()`, `$editForGroup()`, …), excepto onde interagem com o grupo seguro.
* Garantias declaradas na documentação (o que vamos tentar quebrar):
  1. Os valores sensíveis nunca são duplicados nem guardados na definição actual;
  2. Os valores aparecem sempre mascarados por omissão (abrir, imprimir, partilhar ecrã);
  3. Cada revelação fica registada;
  4. O acesso directo é controlado pelas permissões da definição segura.
* Limitação assumida por desenho (não é uma ameaça): quem pode ver a instância envolvente pode revelar os valores — `$securedAccess()` é mascaramento + auditoria, não uma barreira de acesso.

### 2. Sistema + Decomposição [10m]

* Revisão do DFD sobre o exemplo `Devices` / `Device Credentials`
* Identificação de:
  * **Componentes principais**: UI (bloco seguro + botão de revelar), servidor RecordM (resolução pelo campo de referência, mascaramento, endpoint de revelação), definição actual, definição segura, motor de permissões, registo de auditoria, índice de pesquisa/exportações
  * **Actores**: utilizador que consulta a instância; utilizador que revela; admin/modelador que declara as keywords; consumidores de API e integrações; auditor
  * **Fluxos de dados**: apresentação → resolução da instância segura → valores mascarados; clique no olho → valor em claro + escrita de auditoria; declaração das keywords na definição
  * **Fronteiras de confiança**: browser ↔ servidor; permissões da definição actual vs. da definição segura; estado mascarado vs. revelado; tempo de configuração (admin) vs. tempo de execução (utilizador)
* Confirmação das respostas escritas às dúvidas técnicas (enviadas na preparação) — discutir ao vivo apenas as que ficaram em aberto

### 3. Brainstorming de Ameaças [25m]

* STRIDE com foco desigual: **Information Disclosure** e **Elevation of Privilege** são as categorias dominantes nesta feature; **Repudiation** pesa mais do que o habitual porque a auditoria das revelações é uma garantia central. Registo de todas as ameaças, sem filtragem inicial. Pontos de partida:
  * **Spoofing** [3m]: criar ou re-apontar o campo de referência de uma instância segura para expor os seus valores numa instância que o atacante consegue ver; forjar pedidos de revelação em nome de outro utilizador
  * **Tampering** [3m]: alterar valores seguros através do grupo na instância actual; alterar a definição para remover/trocar as keywords; adulterar ou apagar registos de auditoria
  * **Repudiation** [4m]: caminhos que devolvem o valor em claro sem gerar auditoria (revelação via API directa, exportações, acesso directo à definição segura); registo sem detalhe suficiente para imputar a revelação
  * **Information Disclosure** [8m]: valor em claro no payload antes da revelação; fuga via pesquisa/índice, exportações, impressões, relatórios, notificações ou logs do servidor; scraping em massa de revelações via API; valores em cache/histórico do browser; a própria entrada de auditoria a conter o valor
  * **Denial of Service** [3m]: leitura remota em cada apresentação (amplificação em listagens grandes); flooding do endpoint de revelação; crescimento do registo de auditoria
  * **Elevation of Privilege** [4m]: declarar `$securedAccess()` contra uma definição segura a que o modelador não tem acesso (confused deputy em tempo de configuração); resolução que ignora as permissões da definição segura; contornar `$restricted()` aplicado ao próprio grupo

### 4. Avaliação de Risco [10m]

* Agrupar duplicados e classificar cada ameaça na matriz **probabilidade × impacto**
* Determinação do nível de risco (Baixo, Médio, Alto, Crítico) _excluir riscos reais de limitações assumidas por desenho (ex.: revelação por quem vê a instância) mas confirmar que a documentação as comunica bem_

### 5. Mitigações [5m]

* Para cada risco **Alto/Crítico**: registar o requisito de segurança de alto nível e o responsável — o desenho detalhado do controlo é feito e revisto nos tickets/PR, fora da sala. Exemplos de requisitos:
  * O valor em claro nunca é incluído em respostas antes de uma revelação explícita
  * A resolução pelo campo de referência avalia as permissões de leitura da definição segura no contexto do utilizador
  * Todos os caminhos que devolvem valor em claro escrevem auditoria (quem, quando, instância, campo — nunca o valor)
  * Rate limiting no endpoint de revelação
* **Mitigações de documentação:** avisos a acrescentar à página `14_secured-access.md` (já avisa para restringir o próprio grupo; acrescentar o que a sessão identificar)

### 6. Próximos Passos + Encerramento [5m]

* Validação do output da sessão: lista de ameaças, avaliação de risco
* Tickets a criar 
* Feedback rápido da sessão
