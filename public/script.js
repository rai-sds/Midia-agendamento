// Usa o cliente global do Supabase
const supabase = window.supabase;

let calendar;

// utility: formata ISO date (YYYY-MM-DD) para dd/mm/yyyy
function formatarData(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// retorna se estamos em mobile (força list view)
function isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

// fallback CSS mínimo caso main.min.css não carregue
function ensureFullCalendarCss() {
  const hasFc = Array.from(document.styleSheets).some(ss => {
    try {
      return ss.href && ss.href.includes("fullcalendar") || Array.from(ss.cssRules || []).some(r => r.selectorText && r.selectorText.includes(".fc"));
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

  const tbody = document.getElementById("lista-agendamentos");
  tbody.innerHTML = "";
  agendamentos.forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${a.professora}</td>
      <td>${a.turma}</td>
      <td>${a.local ?? ""}</td>
      <td>${formatarData(a.data)}</td>
      <td>${a.inicio?.slice(0,5) ?? ""}</td>
      <td>${a.fim?.slice(0,5) ?? ""}</td>
    `;
    tbody.appendChild(tr);
  });

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
      events: eventos.length ? eventos : [{
        title: "Sem agendamentos",
        start: new Date().toISOString().slice(0,10) + "T09:00",
        end: new Date().toISOString().slice(0,10) + "T09:30"
      }],
      displayEventTime: true,
      eventDisplay: "block",
      dayMaxEventRows: 3,
      moreLinkClick: "popover",
      eventClick: info => {
        abrirModal(info.event.extendedProps);
      }
    });
    calendar.render();
    window.addEventListener("resize", () => {
      const newView = isMobile() ? "listMonth" : "dayGridMonth";
      if (calendar && calendar.view.type !== newView) calendar.changeView(newView);
      calendar.updateSize();
    });
    setTimeout(() => calendar.updateSize(), 80);
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

document.getElementById("form-agendamento").addEventListener("submit", async (e) => {
  e.preventDefault();

  const professora = document.getElementById("professora").value.trim();
  const turma = document.getElementById("turma").value.trim();
  const local = document.getElementById("local").value.trim();
  const data = document.getElementById("data").value;
  const inicio = document.getElementById("inicio").value;
  const fim = document.getElementById("fim").value;

  if (!professora || !turma || !local || !data || !inicio || !fim) {
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

  // valida se horário está dentro dos intervalos permitidos
  let turnoValido = false;

  const manhaInicio = 7 * 60 + 45;
  const manhaFim = 11 * 60 + 15;
  const tardeInicio = 13 * 60 + 15;
  const tardeFimSegQui = 16 * 60 + 45;
  const tardeFimSex = 15 * 60 + 15;

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
  } else {
    alert("Não é permitido agendar aos finais de semana.");
    return;
  }

  if (!turnoValido) {
    alert("Horário fora dos intervalos permitidos:\n\n• Manhã: 07:45 – 11:15\n• Tarde (Seg–Qui): 13:15 – 16:45\n• Tarde (Sex): 13:15 – 15:15");
    return;
  }

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

  // ✅ Inserção no Supabase incluindo o campo Local
  const { error } = await supabase
    .from("agendamentos")
    .insert([{ professora, turma, local, data, inicio: inicio + ":00", fim: fim + ":00" }]);

  if (error) {
    alert("Erro ao salvar: " + error.message);
    return;
  }

  document.getElementById("form-agendamento").reset();
  await carregarAgendamentos();
}); // <-- fechamento do addEventListener

// 🔄 Atualiza dica de horário conforme a data escolhida
document.getElementById("data").addEventListener("change", function () {
  const data = new Date(this.value);
  const diaSemana = data.getDay();
  const dicas = document.querySelectorAll(".dica-horario");

  let texto = "Horários permitidos:\n• Manhã: 07:45 – 11:15";
  if (diaSemana >= 1 && diaSemana <= 4) {
    texto += "\n• Tarde: 13:15 – 16:45";
  } else if (diaSemana === 5) {
    texto += "\n• Tarde: 13:15 – 15:15";
  } else {
    texto = "Agendamento não permitido aos finais de semana.";
  }

  dicas.forEach(el => el.textContent = texto);
});

// 🚀 Inicializa o calendário e carrega agendamentos
carregarAgendamentos();
