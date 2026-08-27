cob.custom.customize.push(function(core, utils, ui) {

  const KEYWORD_SECURED_ACCESS = "$securedAccess";
  const KEYWORD_SECURED_INFO = "$securedInfo";
  const HIDDEN_VALUE = "************";

  core.customizeAllInstances((instance, presenter) => {

    presenter.findFieldPs(childFp => childFp.getField().fieldDefinition.configuration.extensions[KEYWORD_SECURED_ACCESS])
      .forEach(securedGroupFP => {
        let securedGroupHtml = securedGroupFP.content()[0];

        if (instance.isNew() || presenter.isGroupEdit()) {
          securedGroupHtml.querySelector(".cob-fields-list").innerHTML =`<p style="margin: 10px">${core.translateString("secured-access", "secured-access.not-available", "localresource/i18n")}</p>`;
          return;
        }

        const confs = securedGroupFP.getField().fieldDefinition.configuration.extensions[KEYWORD_SECURED_ACCESS];

        if (!confs.args || confs.args.length <= 1) {
          securedGroupHtml.innerHTML = `<p class='text-error'>${core.translateString("secured-access", "secured-access.invalid-configuration", "localresource/i18n")}</p>`;
          return;
        }

        securedGroupHtml.querySelector(".group-name")
          .insertAdjacentHTML(
            "beforebegin",
            "<span class=\"toggle-button label js-secured-get-value\" style=\"margin-right: 6px;\" data-state=\"hidden\">" +
            "         <i class=\"js-secured-icon icon-eye-close\"></i> " +
            "       </span>",
          );

        const instanceId = instance.data.id;
        const fields = { };

        presenter.findFieldPsUnder(securedGroupFP, (fp => fp.getField().fieldDefinition.configuration.extensions[KEYWORD_SECURED_INFO]))
          .forEach(sFp => {
            // disable the field. This field will never hold any information.
            sFp.disable();

            const fieldPHtml = sFp.content()[0];
            const inputWrapper = fieldPHtml.querySelector("input").parentNode;

            const sFConf = sFp.getField().fieldDefinition.configuration.extensions[KEYWORD_SECURED_INFO];
            if (!sFConf.args || sFConf.args.length !== 1) {
              fieldPHtml.querySelector("input").parentNode.innerHTML = `<p class='text-error'>${core.translateString("secured-access", "secured-access.invalid-configuration", "localresource/i18n")}</h4>`;
              return;
            }

            const secretField = sFConf.args[0];

            // replace the input with another so we can change the value without
            // affecting the instance field
            inputWrapper.innerHTML = `<input type="text"
                  class="js-secured-info box-border field-value cob-field-value w-60 disabled"
                  style="width: 200px;"
                  readonly=""
                  data-field="${secretField}"
                  value="${HIDDEN_VALUE}">`;

            fields[secretField] = inputWrapper.childNodes[0]
          });

        securedGroupHtml.querySelector(".js-secured-get-value")
          .addEventListener("click", async (ev) => {
            const revealButton = ev.currentTarget;

            if (revealButton.dataset.state === "hidden") {
              try {
                const secrets = await getSecret(
                  instanceId,
                  securedGroupFP.getField().fieldDefinition.id,
                  Object.keys(fields));

                for (const [key, input] of Object.entries(fields)) {
                  input.value = secrets[key];
                }

                const icon = revealButton.querySelector(".js-secured-icon");
                icon.classList.replace("icon-eye-close","icon-eye-open")
                revealButton.dataset.state = "visible"

              } catch (e) {
                console.error(e)
                ui.notification.showError("Erro a obter segredo", true);
              }

            } else {
              revealButton.dataset.state = "hidden";

              Object.values(fields).forEach(input => input.value = HIDDEN_VALUE);

              const icon = revealButton.querySelector(".js-secured-icon");
              icon.classList.replace("icon-eye-open", "icon-eye-close")
            }

          });
      });
  });

  async function getSecret(instanceId, securedFieldDefId, fields) {
    core.showLoading("get-secret");

    try {
      const result = await fetch("/integrationm/concurrent/_secured-access-get-secrets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instanceId,
          securedFieldDefId,
          fields,
        }),
      }).then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      });

      return result.secrets;

    } finally {
      core.hideLoading("get-secret");
    }
  }

});
