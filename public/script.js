// Usa o cliente global do Supabase
const supabase = window.supabase;

let calendar;
let isAdmin = false; // controle local opcional

// formata ISO date (YYYY-MM-DD) para dd/mm/yyyy
function formatarData(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function ensureFullCalendarCss() {
  const hasFc = Array.from(document.styleSheets).some(ss => {
    try {
      return (ss.href && ss.href.includes("fullcalendar")) ||
             Array.from(ss.cssRules || []).some(r => r.selectorText && r.selectorText.includes(".fc"));
    } catch (e) {
      return false;
    }
  });
  if (!hasFc) {
    const style = document.createElement("style");
    style.id = "fc-fallback-style";
    style.textContent = `
      .fc { font-family: inherit; }
      .fc .fc-daygrid-event, .fc .fc-event { background:#fdb913;color:#002855;border-radius:6px;padding:4px 6px;display:block;margin:4px 0; }
      .fc-toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    `;
    document.head.appendChild(style);
  }
}

// converte data + time local strings para ISO local sem timezone changes
function toLocalISO(dateYMD, timeHHMM) {
  const [y, m, d] = dateYMD.split("-").map(Number);
  const [hh, mm] = timeHHMM.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  const pad = n => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

// aplica limites de hora conforme dia (horários atualizados)
function aplicarLimitesHora(diaSemana) {
  const inicioEl = document.getElementById("inicio");
  const fimEl = document.getElementById("fim");

  // Horários atualizados conforme cartaz
  let minInicio = "07:45";
  let maxFim = "11:55";

  if (diaSemana >= 1 && diaSemana <= 4) {
    // Seg a Qui: manhã e tarde até 17:20
    minInicio = "07:45";
    maxFim = "17:20";
  } else if (diaSemana === 5) {
    // Sexta: manhã e tarde até 15:45
    minInicio = "07:45";
    maxFim = "15:45";
  } else {
    // Fim de semana: mantido 07:00 - 22:00, mas só aceito por admin
    minInicio = "07:00";
    maxFim = "22:00";
  }

  inicioEl.min = minInicio;
  fimEl.max = maxFim;

  if (inicioEl.value) {
    fimEl.min = inicioEl.value;
  } else {
    fimEl.min = minInicio;
  }

  if (inicioEl.value && inicioEl.value < inicioEl.min) inicioEl.value = inicioEl.min;
  if (fimEl.value && fimEl.value > fimEl.max) fimEl.value = fimEl.max;
  if (fimEl.value && fimEl.value < fimEl.min) fimEl.value = fimEl.min;
}

async function carregarAgendamentos() {
  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select("*")
    .order("data", { ascending: true })
    .order("inicio", { ascending: true });

  if (error) {
    console.error("Erro ao carregar agendamentos:", error.message);
    return;
  }

  const agora = new Date();
  const agendamentosLista = agendamentos.filter(a => {
    const fimAg = new Date(`${a.data}T${a.fim || "00:00"}`);
    return fimAg >= agora;
  });

  // Preenche a tabela pública
  const tbody = document.getElementById("lista-agendamentos");
  if (tbody) {
    tbody.innerHTML = "";
    agendamentosLista.forEach(a => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.professora}</td>
        <td>${a.turma}</td>
        <td>${a.local ?? ""}</td>
        <td>${a.evento ?? ""}</td>
        <td>${formatarData(a.data)}</td>
        <td>${a.inicio?.slice(0,5) ?? ""}</td>
        <td>${a.fim?.slice(0,5) ?? ""}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Preenche a tabela do admin se presente (alguns projetos exibem a mesma tabela)
  const adminTbody = document.getElementById("admin-agendamentos");
  if (adminTbody) {
    adminTbody.innerHTML = "";
    agendamentos.forEach(a => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.professora}</td>
        <td>${a.turma}</td>
        <td>${a.local ?? ""}</td>
        <td>${a.evento ?? ""}</td>
        <td>${formatarData(a.data)}</td>
        <td>${a.inicio?.slice(0,5) ?? ""}</td>
        <td>${a.fim?.slice(0,5) ?? ""}</td>
        <td>
          <button class="editar-btn" data-id="${a.id}">Editar</button>
          <button class="remover-btn" data-id="${a.id}">Remover</button>
        </td>
      `;
      adminTbody.appendChild(tr);
    });

    // listeners de ação admin (delegation não usado para compatibilidade)
    adminTbody.querySelectorAll(".remover-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (confirm("Deseja realmente remover este agendamento?")) {
          const id = btn.getAttribute("data-id");
          const { error } = await supabase.from("agendamentos").delete().eq("id", id);
          if (error) alert("Erro ao remover: " + error.message);
          else carregarAgendamentos();
        }
      });
    });

    adminTbody.querySelectorAll(".editar-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const { data } = await supabase.from("agendamentos").select("*").eq("id", id).single();
        if (data) {
          // Preenche campos públicos/admin (mesmos ids em admin.html)
          const formSection = document.getElementById("admin-form-section");
          if (formSection) formSection.style.display = "block";
          document.getElementById("admin-form-title")?.textContent && (document.getElementById("admin-form-title").textContent = "Editar Agendamento");
          document.getElementById("professora").value = data.professora;
          document.getElementById("turma").value = data.turma;
          document.getElementById("local").value = data.local;
          document.getElementById("evento").value = data.evento;
          document.getElementById("data").value = data.data;
          document.getElementById("inicio").value = data.inicio.slice(0,5);
          document.getElementById("fim").value = data.fim.slice(0,5);
          // se form-admin-agendamento existe, marca edição
          const adminForm = document.getElementById("form-admin-agendamento");
          if (adminForm) adminForm.setAttribute("data-edit-id", id);
          // para editar no index (se estiver usando esse fluxo), removemos o registro antigo para evitar duplicata
          // nota: o comportamento exato de edição pode variar conforme sua escolha; aqui mantemos fetch + set no form para update posterior
        }
      });
    });
  }

  // --- Preenche o calendário ---
  const eventos = agendamentos.map(a => {
    const inicio = a.inicio?.slice(0,5) ?? "07:00";
    const fim = a.fim?.slice(0,5) ?? "08:00";
    return {
      title: `${a.turma} - ${a.professora} (${a.local ?? ""})`,
      start: toLocalISO(a.data, inicio),
      end: toLocalISO(a.data, fim),
      extendedProps: { ...a }
    };
  });

  ensureFullCalendarCss();

  if (!calendar) {
    const calendarEl = document.getElementById("calendar");
    if (!calendarEl) return;
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: isMobile() ? "listMonth" : "dayGridMonth",
      locale: "pt-br",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: isMobile() ? "listMonth" : "dayGridMonth"
      },
      views: { listMonth: { buttonText: "Lista" } },
      buttonText: { today: "Hoje" },
      height: "auto",
      events: eventos,
      displayEventTime: true,
      eventDisplay: "block",
      dayMaxEventRows: 3,
      moreLinkClick: "popover",
      eventClick: info => {
        abrirModal(info.event.extendedProps);
      }
    });
    calendar.render();
  } else {
    calendar.removeAllEvents();
    calendar.addEventSource(eventos);
    calendar.updateSize();
  }
}

function abrirModal(props) {
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <h3>📌 Detalhes do Agendamento</h3>
    <p><strong>Agendante:</strong> ${props.professora}</p>
    <p><strong>Turma:</strong> ${props.turma}</p>
    <p><strong>Local:</strong> ${props.local ?? ""}</p>
    <p><strong>Tipo de Evento:</strong> ${props.evento ?? ""}</p>
    <p><strong>Data:</strong> ${formatarData(props.data)}</p>
    <p><strong>Início:</strong> ${props.inicio?.slice(0,5) ?? ""}</p>
    <p><strong>Fim:</strong> ${props.fim?.slice(0,5) ?? ""}</p>
    <button id="fecharModal">Fechar</button>
  `;
  modal.style.display = "block";
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("fecharModal").onclick = () => {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  };
}

// listeners de limites de hora
document.getElementById("data")?.addEventListener("change", function () {
  if (!this.value) return;
  const data = new Date(this.value);
  const diaSemana = data.getDay();
  aplicarLimitesHora(diaSemana);
});

document.getElementById("inicio")?.addEventListener("change", function () {
  const fimEl = document.getElementById("fim");
  if (this.value) {
    fimEl.min = this.value;
    if (fimEl.value && fimEl.value < fimEl.min) {
      fimEl.value = fimEl.min;
    }
  }
});

// SUBMIT do formulário de agendamento (público)
document.getElementById("form-agendamento")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const professora = document.getElementById("professora").value.trim();
  const turma = document.getElementById("turma").value.trim();
  const local = document.getElementById("local").value.trim();
  const evento = document.getElementById("evento").value.trim();
  const data = document.getElementById("data").value;
  const inicio = document.getElementById("inicio").value;
  const fim = document.getElementById("fim").value;

  if (!professora || !turma || !local || !evento || !data || !inicio || !fim) {
    alert("Preencha todos os campos.");
    return;
  }

  const dt = new Date(data + "T00:00");
  const diaSemana = dt.getDay();

  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  const inicioTotal = hi * 60 + mi;
  const fimTotal = hf * 60 + mf;

  if (inicioTotal >= fimTotal) {
    alert("O horário de fim deve ser posterior ao horário de início.");
    return;
  }

  // valida se horário está dentro dos intervalos permitidos (HORÁRIOS ATUALIZADOS)
  let turnoValido = false;

  const manhaInicio = 7 * 60 + 45;
  const manhaFim = 11 * 60 + 55;     // atualizado
  const tardeInicio = 13 * 60 + 15;
  const tardeFimSegQui = 17 * 60 + 20; // atualizado
  const tardeFimSex = 15 * 60 + 45;    // atualizado
  const fimDeSemanaInicio = 7 * 60;
  const fimDeSemanaFim = 22 * 60;

  if (diaSemana >= 1 && diaSemana <= 5) {
    if (inicioTotal >= manhaInicio && fimTotal <= manhaFim) {
      turnoValido = true;
    }
    if (inicioTotal >= tardeInicio) {
      if (diaSemana === 5 && fimTotal <= tardeFimSex) {
        turnoValido = true;
      } else if (diaSemana >= 1 && diaSemana <= 4 && fimTotal <= tardeFimSegQui) {
        turnoValido = true;
      }
    }
  } else if (diaSemana === 0 || diaSemana === 6) {
    // fim de semana só permitido para admin
    if (isAdmin && inicioTotal >= fimDeSemanaInicio && fimTotal <= fimDeSemanaFim) {
      turnoValido = true;
    }
  }

  if (!turnoValido && !isAdmin) {
    alert("Horário fora dos intervalos permitidos:\n\n• Manhã (Seg–Sex): 07:45 – 11:55\n• Tarde (Seg–Qui): 13:15 – 17:20\n• Tarde (Sex): 13:15 – 15:45\n• Fim de semana: 07:00 – 22:00 (somente administradores)\n\nSomente administradores podem criar agendamentos fora do padrão.");
    return;
  }

  // verifica conflitos
  const { data: existentes } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("data", data);

  if (existentes && existentes.length) {
    const overlap = existentes.some(x => {
      const s = parseInt((x.inicio || "00:00").slice(0,2)) * 60 + parseInt((x.inicio || "00:00").slice(3,5));
      const e = parseInt((x.fim || "00:00").slice(0,2)) * 60 + parseInt((x.fim || "00:00").slice(3,5));
      return Math.max(s, inicioTotal) < Math.min(e, fimTotal);
    });
    if (overlap) {
      if (!confirm("Já existe um agendamento conflitando nesse horário. Deseja prosseguir?")) {
        return;
      }
    }
  }

  // Inserção no Supabase
  const { error } = await supabase
    .from("agendamentos")
    .insert([{ professora, turma, local, evento, data, inicio: inicio + ":00", fim: fim + ":00" }]);

  if (error) {
    alert("Erro ao salvar: " + error.message);
    return;
  }

  document.getElementById("form-agendamento").reset();
  await carregarAgendamentos();
});

// Inicializa o calendário e carrega agendamentos
carregarAgendamentos();

// ================= Sidebar (se existir elementos no index) =================

// abrir / fechar sidebar (caso o index tenha os elementos)
const btnSidebar = document.getElementById("btn-sidebar");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const closeSidebarBtn = document.getElementById("close-sidebar");

function abrirSidebar() {
  if (!sidebar || !sidebarOverlay) return;
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("open");
  sidebar.setAttribute("aria-hidden", "false");
  sidebarOverlay.setAttribute("aria-hidden", "false");
}
function fecharSidebar() {
  if (!sidebar || !sidebarOverlay) return;
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("open");
  sidebar.setAttribute("aria-hidden", "true");
  sidebarOverlay.setAttribute("aria-hidden", "true");
}

btnSidebar?.addEventListener("click", abrirSidebar);
closeSidebarBtn?.addEventListener("click", fecharSidebar);
sidebarOverlay?.addEventListener("click", fecharSidebar);

// Login via sidebar (redireciona para admin.html quando correto)
// Observação: senha fixa em frontend é apenas exemplo; em produção use autenticação no backend/Supabase Auth
document.getElementById("form-admin-login-sidebar")?.addEventListener("submit", function(e) {
  e.preventDefault();
  const senha = document.getElementById("admin-senha-sidebar").value;
  if (senha === "Midia123") {
    // marca admin local (se quiser permitir ações imediatas sem redirecionar)
    isAdmin = true;
    // redireciona ao painel admin
    window.location.href = "admin.html";
  } else {
    alert("Senha incorreta.");
  }
});
