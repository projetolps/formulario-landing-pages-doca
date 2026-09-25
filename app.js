(function () {
  "use strict";

  const config = Object.freeze({
    whatsappUrl: "https://wa.me/5564999004893",
    n8nWebhook: "https://nnwb.docacompany.com.br/webhook/form-lp-fabricinho",
    googleSheetsWebhook:
      "https://script.google.com/macros/s/AKfycbwZxiP8v4VgwXVLzGb0E5yZXcIDSLoJjjLNmlQfIqtxuLkHgEjHcg3XKavXTAyBuG2m/exec",
    source: "formulario_landing_pages_doca",
  });

  const form = document.getElementById("lead-form");
  const steps = Array.from(document.querySelectorAll(".step"));
  const progressLabel = document.getElementById("progress-label");
  const progressValue = document.getElementById("progress-value");
  const progressBar = document.getElementById("progress-bar");
  const progressTrack = document.querySelector(".progress-track");
  const submitButton = document.getElementById("submit-button");
  const submitError = document.getElementById("submit-error");
  const success = document.getElementById("success");
  const successName = document.getElementById("success-name");
  const restartButton = document.getElementById("restart-button");

  let activeStep = 0;
  let leadEventSent = false;

  document.getElementById("year").textContent = new Date().getFullYear();

  function requiredFields(stepIndex) {
    return Array.from(steps[stepIndex].querySelectorAll("input[required]"));
  }

  function errorTarget(field) {
    if (field.name === "first_name" || field.name === "last_name") {
      return document.querySelector('[data-error-for="identity"]');
    }
    return document.querySelector(`[data-error-for="${field.name}"]`);
  }

  function showError(field, message) {
    const target = errorTarget(field);
    if (target) target.textContent = message;
    field.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function clearErrors(stepIndex) {
    steps[stepIndex].querySelectorAll(".field-error").forEach((node) => {
      node.textContent = "";
    });
    requiredFields(stepIndex).forEach((field) => field.removeAttribute("aria-invalid"));
  }

  function nationalPhoneDigits(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
    return digits.slice(0, 11);
  }

  function phoneForDataLayer(value) {
    const national = nationalPhoneDigits(value);
    return national ? `55${national}` : "";
  }

  function formatPhone(value) {
    const digits = nationalPhoneDigits(value);
    if (!digits) return "";
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function validateField(field) {
    if (field.type === "radio") {
      const selected = form.querySelector(`input[name="${field.name}"]:checked`);
      if (!selected) {
        showError(field, "Escolha uma opção para concluir.");
        return false;
      }
      showError(field, "");
      return true;
    }

    const value = field.value.trim();
    if (!value) {
      showError(field, "Preencha este campo para continuar.");
      return false;
    }

    if ((field.name === "first_name" || field.name === "last_name") && value.length < 2) {
      showError(field, "Digite seu nome e sobrenome.");
      return false;
    }

    if (field.name === "phone") {
      const digits = nationalPhoneDigits(value);
      if (digits.length < 10 || digits.length > 11) {
        showError(field, "Digite um telefone válido com DDD.");
        return false;
      }
    }

    if (field.type === "email" && !field.validity.valid) {
      showError(field, "Digite um e-mail válido.");
      return false;
    }

    showError(field, "");
    return true;
  }

  function validateStep(stepIndex) {
    clearErrors(stepIndex);
    const fields = requiredFields(stepIndex);
    const uniqueFields = fields.filter(
      (field, index, list) =>
        field.type !== "radio" ||
        list.findIndex((candidate) => candidate.name === field.name) === index
    );
    const validity = uniqueFields.map(validateField);
    const invalidIndex = validity.indexOf(false);
    if (invalidIndex >= 0) uniqueFields[invalidIndex].focus();
    return validity.every(Boolean);
  }

  function updateProgress() {
    const answered = activeStep;
    const percentage = Math.round((answered / steps.length) * 100);
    progressLabel.textContent = `Pergunta ${activeStep + 1} de ${steps.length}`;
    progressValue.textContent = `${percentage}%`;
    progressBar.style.width = `${percentage}%`;
    progressTrack.setAttribute("aria-valuenow", String(percentage));
  }

  function focusFirstField() {
    const focusable = steps[activeStep].querySelector(
      'input:not([type="radio"]), input[type="radio"]'
    );
    if (focusable) window.setTimeout(() => focusable.focus({ preventScroll: true }), 120);
  }

  function showStep(nextStep) {
    if (nextStep < 0 || nextStep >= steps.length) return;
    steps[activeStep].classList.remove("is-active");
    activeStep = nextStep;
    steps[activeStep].classList.add("is-active");
    updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
    focusFirstField();
  }

  document.querySelectorAll("[data-next]").forEach((button) => {
    button.addEventListener("click", () => {
      if (validateStep(activeStep)) showStep(activeStep + 1);
    });
  });

  document.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", () => showStep(activeStep - 1));
  });

  form.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.target.type === "radio") return;
    event.preventDefault();
    const nextButton = steps[activeStep].querySelector("[data-next]");
    if (nextButton) nextButton.click();
  });

  const phoneInput = document.getElementById("phone");
  phoneInput.addEventListener("input", () => {
    const cursorAtEnd = phoneInput.selectionStart === phoneInput.value.length;
    phoneInput.value = formatPhone(phoneInput.value);
    if (cursorAtEnd) {
      phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
    }
  });

  document.querySelectorAll('input[name="invests_in_marketing"]').forEach((input) => {
    input.addEventListener("change", () => {
      const target = document.querySelector('[data-error-for="invests_in_marketing"]');
      if (target) target.textContent = "";
    });
  });

  function leadData() {
    const data = new FormData(form);
    const query = new URLSearchParams(window.location.search);
    return {
      first_name: String(data.get("first_name") || "").trim(),
      last_name: String(data.get("last_name") || "").trim(),
      phone: phoneForDataLayer(data.get("phone")),
      email: String(data.get("email") || "").trim().toLowerCase(),
      invests_in_marketing: String(data.get("invests_in_marketing") || ""),
      source: config.source,
      page_url: window.location.href,
      referrer: document.referrer || "",
      utm_source: query.get("utm_source") || "",
      utm_medium: query.get("utm_medium") || "",
      utm_campaign: query.get("utm_campaign") || "",
      utm_content: query.get("utm_content") || "",
      utm_term: query.get("utm_term") || "",
      submission_id:
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      submitted_at: new Date().toISOString(),
    };
  }

  function pushLeadLanding(lead) {
    if (leadEventSent) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "lead_landing",
      first_name: lead.first_name,
      last_name: lead.last_name,
      phone: lead.phone,
      email: lead.email,
      invests_in_marketing: lead.invests_in_marketing,
    });
    leadEventSent = true;
  }

  function transportBody(lead) {
    const body = new URLSearchParams();
    Object.entries(lead).forEach(([key, value]) => body.set(key, String(value || "")));
    return body;
  }

  async function postLead(url, lead) {
    if (!url || url.startsWith("__")) {
      throw new Error("Uma das integrações do formulário ainda não foi configurada.");
    }

    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit",
      keepalive: true,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: transportBody(lead),
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitError.textContent = "";
    if (!validateStep(activeStep)) return;

    const lead = leadData();
    submitButton.disabled = true;
    submitButton.innerHTML = 'Enviando… <span aria-hidden="true">→</span>';
    pushLeadLanding(lead);

    try {
      await Promise.all([
        postLead(config.n8nWebhook, lead),
        postLead(config.googleSheetsWebhook, lead),
      ]);

      successName.textContent = lead.first_name;
      form.hidden = true;
      success.hidden = false;
      progressLabel.textContent = "Diagnóstico concluído";
      progressValue.textContent = "100%";
      progressBar.style.width = "100%";
      progressTrack.setAttribute("aria-valuenow", "100");
      success.focus();

      window.setTimeout(() => {
        window.location.href = config.whatsappUrl;
      }, 450);
    } catch (error) {
      submitError.textContent =
        "Não foi possível registrar suas respostas agora. Verifique sua conexão e tente novamente.";
      submitButton.disabled = false;
      submitButton.innerHTML = 'Enviar e ir ao WhatsApp <span aria-hidden="true">→</span>';
    }
  });

  restartButton.addEventListener("click", () => {
    success.hidden = true;
    form.hidden = false;
    submitButton.disabled = false;
    steps.forEach((step) => step.classList.remove("is-active"));
    activeStep = 0;
    steps[0].classList.add("is-active");
    updateProgress();
    focusFirstField();
  });

  updateProgress();
})();
