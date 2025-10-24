// Usa o cliente global do Supabase
const supabase = window.supabase;

// debug inicial
console.log("script-admin.js carregado");
if (!window.supabase) console.error("ERRO: window.supabase não encontrado. Verifique supabaseClient.js");

// checa se horário fora do padrão (horários atualizados conforme cartaz)
function isHorarioForaDoPadrao(data, inicio, fim) {
  if (!data || !inicio || !fim) return true;
  const dt = new Date(data + "T00:00");
  const diaSemana = dt.getDay();

  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  const inicioTotal = hi * 60 + mi;
  const fimTotal = hf * 60 + mf;

  const manhaInicio = 7 * 60 + 45;
  const manhaFim = 11 * 60 + 55;      // atualizado
  const tardeInicio = 13 * 60 + 15;
  const tardeFimSegQui = 17 * 60 + 20; // atualizado
  const tardeFimSex = 15 * 60 + 45;    // atualizado
  const fimDeSemanaInicio = 7 * 60;
  const fimDeSemanaFim = 22 * 60;

  let valido = false;
  if (diaSemana >= 1 && diaSemana <= 5) {
    if (inicioTotal >= manhaInicio && fimTotal <= manhaFim) valido = true;
    if (inicioTotal >= tardeInicio) {
      if (diaSemana === 5 && fimTotal <= tardeFimSex) valido = true;
      else if (diaSemana >= 1 && diaSemana <= 4 && fimTotal <= tardeFimSegQui) valido = true;
    }
  } else if (diaSemana === 0 || diaSemana === 6) {
    if (inicioTotal >= fimDeSemanaInicio && fimTotal <= fimDeSemanaFim) valido = true;
  }

  return !valido;
}

function formatarData(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function carregarAgendamentos() {
  try {
    if (!window.supabase) {
      console.error("Cannot load agendamentos: supabase not initialized");
      return;
    }

    const { data: agendamentos, error } = await supabase
      .from("agendamentos")
      .select("*")
      .order("data", { ascending: true })
      .order("inicio", { ascending: true });

    if (error) {
      console.error("Erro ao carregar agendamentos:", error.message);
      return;
    }

    const lista = Array.isArray(agendamentos) ? agendamentos : [];

    // filtra apenas agendamentos que ainda não acabaram (fim >= agora)
    const agora = new Date();
    const ativos = lista.filter(a => {
      if (!a || !a.data || !a.fim) return false;
      // a.fim pode estar no formato "HH:MM:SS" ou "HH:MM"
      const fimStr = a.fim.slice(0,5);
      const fimDt = new Date(`${a.data}T${fimStr}`);
      return fimDt >= agora;
    });

    // Preenche a tabela admin com apenas agendamentos ativos
    const tbody = document.getElementById("admin-agendamentos");
    if (!tbody) {
      console.error("Elemento #admin-agendamentos não encontrado no DOM");
    } else {
      tbody.innerHTML = "";
      ativos.forEach(a => {
        const dataFmt = a.data ? formatarData(a.data) : "";
        const inicio = a.inicio ? a.inicio.slice(0,5) : "";
        const fim = a.fim ? a.fim.slice(0,5) : "";

        const tr = document.createElement("tr");
        // aplica classe apenas se estiver fora do padrão
        if (isHorarioForaDoPadrao(a.data, inicio, fim)) {
          tr.classList.add("fora-padrao");
        }
        tr.innerHTML = `
          <td>${a.professora ?? ""}</td>
          <td>${a.turma ?? ""}</td>
          <td>${a.local ?? ""}</td>
          <td>${a.evento ?? ""}</td>
          <td>${dataFmt}</td>
          <td>${inicio}</td>
          <td>${fim}</td>
          <td>
            <button class="editar-btn" data-id="${a.id}">Editar</button>
            <button class="remover-btn" data-id="${a.id}">Remover</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // attach listeners (remove listeners antigos antes)
    document.querySelectorAll(".remover-btn").forEach(btn => {
      if (btn._rmListener) btn.removeEventListener("click", btn._rmListener);
      const rmListener = async () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        if (confirm("Deseja remover este agendamento?")) {
          const { error } = await supabase.from("agendamentos").delete().eq("id", id);
          if (error) alert("Erro ao remover: " + error.message);
          else carregarAgendamentos();
        }
      };
      btn.addEventListener("click", rmListener);
      btn._rmListener = rmListener;
    });

    document.querySelectorAll(".editar-btn").forEach(btn => {
      if (btn._editListener) btn.removeEventListener("click", btn._editListener);
      const editListener = async () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        const { data, error } = await supabase.from("agendamentos").select("*").eq("id", id).single();
        if (error) {
          alert("Erro ao buscar: " + error.message);
          return;
        }
        const formSection = document.getElementById("admin-form-section");
        if (formSection) formSection.style.display = "block";
        const titleEl = document.getElementById("admin-form-title");
        if (titleEl) titleEl.textContent = "Editar Agendamento";
        const setIf = (idEl, val) => {
          const el = document.getElementById(idEl);
          if (el && val != null) el.value = val;
        };
        setIf("professora", data.professora);
        setIf("turma", data.turma);
        setIf("local", data.local);
        setIf("evento", data.evento);
        setIf("data", data.data);
        setIf("inicio", data.inicio ? data.inicio.slice(0,5) : "");
        setIf("fim", data.fim ? data.fim.slice(0,5) : "");
        const adminForm = document.getElementById("form-admin-agendamento");
        if (adminForm) adminForm.setAttribute("data-edit-id", id);
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      };
      btn.addEventListener("click", editListener);
      btn._editListener = editListener;
    });

  } catch (err) {
    console.error("Erro inesperado em carregarAgendamentos:", err);
  }
}

// Salvar (novo ou edição)
const adminForm = document.getElementById("form-admin-agendamento");
if (adminForm) {
  adminForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const professora = document.getElementById("professora").value.trim();
    const turma = document.getElementById("turma").value.trim();
    const local = document.getElementById("local").value.trim();
    const evento = document.getElementById("evento").value.trim();
    const data = document.getElementById("data").value;
    const inicio = document.getElementById("inicio").value;
    const fim = document.getElementById("fim").value;

    const idEdicao = e.target.getAttribute("data-edit-id");

    if (!professora || !turma || !local || !evento || !data || !inicio || !fim) {
      alert("Preencha todos os campos.");
      return;
    }

    try {
      if (idEdicao) {
        const { error } = await supabase
          .from("agendamentos")
          .update({ professora, turma, local, evento, data, inicio: inicio + ":00", fim: fim + ":00" })
          .eq("id", idEdicao);

        if (error) alert("Erro ao atualizar: " + error.message);
        else {
          alert("Agendamento atualizado!");
          e.target.removeAttribute("data-edit-id");
          e.target.reset();
          const formSection = document.getElementById("admin-form-section");
          if (formSection) formSection.style.display = "none";
          carregarAgendamentos();
        }
      } else {
        const { error } = await supabase
          .from("agendamentos")
          .insert([{ professora, turma, local, evento, data, inicio: inicio + ":00", fim: fim + ":00" }]);

        if (error) alert("Erro ao inserir: " + error.message);
        else {
          alert("Agendamento criado!");
          e.target.reset();
          const formSection = document.getElementById("admin-form-section");
          if (formSection) formSection.style.display = "none";
          carregarAgendamentos();
        }
      }
    } catch (err) {
      console.error("Erro inesperado ao salvar agendamento:", err);
      alert("Erro inesperado. Veja o console.");
    }
  });
} else {
  console.warn("#form-admin-agendamento não encontrado; formulário de criação estará indisponível.");
}

// Botão Adicionar e Cancelar
const btnAdd = document.getElementById("btn-adicionar");
if (btnAdd) {
  btnAdd.addEventListener("click", () => {
    const formSection = document.getElementById("admin-form-section");
    if (formSection) formSection.style.display = "block";
    const title = document.getElementById("admin-form-title");
    if (title) title.textContent = "Novo Agendamento";
    const f = document.getElementById("form-admin-agendamento");
    if (f) {
      f.reset();
      f.removeAttribute("data-edit-id");
    }
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });
} else {
  console.warn("#btn-adicionar não encontrado no DOM");
}

const btnCancelar = document.getElementById("btn-cancelar");
if (btnCancelar) {
  btnCancelar.addEventListener("click", () => {
    const formSection = document.getElementById("admin-form-section");
    if (formSection) formSection.style.display = "none";
    const f = document.getElementById("form-admin-agendamento");
    if (f) {
      f.removeAttribute("data-edit-id");
      f.reset();
    }
  });
}

carregarAgendamentos();
