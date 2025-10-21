// Usa o cliente global do Supabase
const supabase = window.supabase;

// checa se horário fora do padrão
function isHorarioForaDoPadrao(data, inicio, fim) {
  const dt = new Date(data + "T00:00");
  const diaSemana = dt.getDay();

  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  const inicioTotal = hi * 60 + mi;
  const fimTotal = hf * 60 + mf;

  const manhaInicio = 7 * 60 + 45;
  const manhaFim = 11 * 60 + 15;
  const tardeInicio = 13 * 60 + 15;
  const tardeFimSegQui = 16 * 60 + 45;
  const tardeFimSex = 15 * 60 + 15;
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

async function carregarAgendamentos() {
  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select("*")
    .order("data", { ascending: true })
    .order("inicio", { ascending: true });

  if (error) {
    console.error("Erro ao carregar:", error.message);
    return;
  }

  const tbody = document.getElementById("admin-agendamentos");
  tbody.innerHTML = "";

  agendamentos.forEach(a => {
    const tr = document.createElement("tr");
    if (isHorarioForaDoPadrao(a.data, a.inicio.slice(0,5), a.fim.slice(0,5))) {
      tr.classList.add("fora-padrao");
    }
    tr.innerHTML = `
      <td>${a.professora}</td>
      <td>${a.turma}</td>
      <td>${a.local ?? ""}</td>
      <td>${a.evento ?? ""}</td>
      <td>${a.data}</td>
      <td>${a.inicio?.slice(0,5) ?? ""}</td>
      <td>${a.fim?.slice(0,5) ?? ""}</td>
      <td>
        <button class="editar-btn" data-id="${a.id}">Editar</button>
        <button class="remover-btn" data-id="${a.id}">Remover</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Remover
  document.querySelectorAll(".remover-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if (confirm("Deseja remover este agendamento?")) {
        const { error } = await supabase.from("agendamentos").delete().eq("id", id);
        if (error) alert("Erro ao remover: " + error.message);
        else carregarAgendamentos();
      }
    });
  });

  // Editar
  document.querySelectorAll(".editar-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const { data, error } = await supabase.from("agendamentos").select("*").eq("id", id).single();
      if (error) {
        alert("Erro ao buscar: " + error.message);
        return;
      }
      const formSection = document.getElementById("admin-form-section");
      formSection.style.display = "block";
      document.getElementById("admin-form-title").textContent = "Editar Agendamento";
      document.getElementById("professora").value = data.professora;
      document.getElementById("turma").value = data.turma;
      document.getElementById("local").value = data.local;
      document.getElementById("evento").value = data.evento;
      document.getElementById("data").value = data.data;
      document.getElementById("inicio").value = data.inicio.slice(0,5);
      document.getElementById("fim").value = data.fim.slice(0,5);
      document.getElementById("form-admin-agendamento").setAttribute("data-edit-id", id);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
  });
}

// Salvar (novo ou edição)
document.getElementById("form-admin-agendamento").addEventListener("submit", async (e) => {
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
      document.getElementById("admin-form-section").style.display = "none";
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
      document.getElementById("admin-form-section").style.display = "none";
      carregarAgendamentos();
    }
  }
});

// Botão Adicionar e Cancelar
document.getElementById("btn-adicionar").addEventListener("click", () => {
  const formSection = document.getElementById("admin-form-section");
  formSection.style.display = "block";
  document.getElementById("admin-form-title").textContent = "Novo Agendamento";
  document.getElementById("form-admin-agendamento").reset();
  document.getElementById("form-admin-agendamento").removeAttribute("data-edit-id");
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
});

document.getElementById("btn-cancelar").addEventListener("click", () => {
  const formSection = document.getElementById("admin-form-section");
  formSection.style.display = "none";
  document.getElementById("form-admin-agendamento").removeAttribute("data-edit-id");
  document.getElementById("form-admin-agendamento").reset();
});

// Inicializa
carregarAgendamentos();
