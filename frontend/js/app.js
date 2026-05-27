
const API_URL = 'http://localhost:3000/api';

// Variáveis de Controle para Edição
let editingCustomerCpf = null;
let editingDeviceSerial = null;
let editingOSId = null;

// --- NAVEGAÇÃO E MENU ---
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('main-content');
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    mainContent.classList.toggle('shifted');
});

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        pages.forEach(page => page.classList.remove('active'));
        
        item.classList.add('active');
        const target = item.getAttribute('data-target');
        document.getElementById(target).classList.add('active');
        
        loadData(target);

        sidebar.classList.remove('active');
        mainContent.classList.remove('shifted');
    });
});

// Fecha menu ao clicar fora (Melhorado)
document.addEventListener('click', (event) => {
    if (sidebar.classList.contains('active') && !sidebar.contains(event.target) && !menuBtn.contains(event.target)) {
        sidebar.classList.remove('active');
        mainContent.classList.remove('shifted');
    }
});

// Exibir/Ocultar Formulários
function toggleForm(formId) {
    const form = document.getElementById(formId);
    form.classList.toggle('active');
    
    if (form.classList.contains('active')) {
        form.reset();
        
        // Esconde o histórico caso esteja abrindo uma nova OS
        if (formId === 'form-os') {
            editingOSId = null;
            document.getElementById('os-historico-problema').style.display = 'none';
            document.getElementById('label-historico').style.display = 'none';
            document.getElementById('os-cpf').disabled = false;
            document.getElementById('os-serial').disabled = false;
        }
        if (formId === 'form-cliente') { editingCustomerCpf = null; document.getElementById('cli-cpf').disabled = false; }
        if (formId === 'form-dispositivo') { editingDeviceSerial = null; document.getElementById('dev-serial').disabled = false; }
    }
}

// --- MÁSCARAS ---
document.addEventListener('input', (e) => {
    if (e.target.id.includes('cpf')) {
        let v = e.target.value.replace(/\D/g, "");
        v = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        e.target.value = v;
    }
    if (e.target.id.includes('tel')) {
        let v = e.target.value.replace(/\D/g, "");
        v = v.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d)(\d{4})$/, "$1-$2");
        e.target.value = v;
    }
});



function validateData(data) {
    for (let key in data) {
        if (!data[key] || (typeof data[key] === 'string' && data[key].trim() === '')) {
            alert('Por favor, preencha todos os campos corretamente.');
            return false;
        }
    }
    return true;
}

function loadData(page) {
    if (page === 'clientes') fetchClientes();
    if (page === 'dispositivos') fetchDispositivos();
    if (page === 'os') fetchOS();
    if (page === 'home') loadDashboard();
}

// --- CLIENTES ---
async function fetchClientes() {
    const res = await fetch(`${API_URL}/customers?t=${new Date().getTime()}`);
    const data = await res.json();
    const tbody = document.querySelector('#table-clientes tbody');
    tbody.innerHTML = '';
    data.forEach(cli => {
        tbody.innerHTML += `<tr><td>${cli.cpf}</td><td>${cli.name}</td><td>${cli.phone}</td><td>${cli.email}</td><td><button class="btn-edit" onclick="editCustomer('${cli.cpf}')"><i class="fas fa-edit"></i></button><button class="btn-danger" onclick="deleteCustomer('${cli.cpf}')"><i class="fas fa-trash"></i></button></td></tr>`;
    });
}

async function editCustomer(cpf) {
    const res = await fetch(`${API_URL}/customers`);
    const data = await res.json();
    const cliente = data.find(c => c.cpf === cpf);
    if (cliente) {
        document.getElementById('cli-cpf').value = cliente.cpf;
        document.getElementById('cli-nome').value = cliente.name;
        document.getElementById('cli-tel').value = cliente.phone;
        document.getElementById('cli-email').value = cliente.email;
        document.getElementById('cli-cpf').disabled = true;
        editingCustomerCpf = cpf;
        document.getElementById('form-cliente').classList.add('active');
        window.scrollTo(0, 0);
    }
}

async function saveCustomer(e) {
    e.preventDefault();
    const cpf = document.getElementById('cli-cpf').value;
    const name = document.getElementById('cli-nome').value;
    const phone = document.getElementById('cli-tel').value;
    const email = document.getElementById('cli-email').value;

    if(!validateData({cpf, name, phone, email})) return;

    const method = editingCustomerCpf ? 'PUT' : 'POST';
    const url = editingCustomerCpf ? `${API_URL}/customers/${editingCustomerCpf}` : `${API_URL}/customers`;

    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, name, phone, email })
    });

    if(response.ok) {
        alert('Cliente salvo!');
        toggleForm('form-cliente');
        fetchClientes();
    }
}

async function deleteCustomer(cpf) {
    if(confirm('Tem certeza? Isso apagará dispositivos e OS vinculadas!')) {
        await fetch(`${API_URL}/customers/${cpf}`, { method: 'DELETE' });
        fetchClientes();
    }
}

// --- DISPOSITIVOS ---
async function fetchDispositivos() {
    const res = await fetch(`${API_URL}/devices?t=${new Date().getTime()}`);
    const data = await res.json();
    const tbody = document.querySelector('#table-dispositivos tbody');
    tbody.innerHTML = '';
    data.forEach(dev => {
        tbody.innerHTML += `<tr><td>${dev.serial_number}</td><td>${dev.customer_cpf}</td><td>${dev.type}</td><td><button class="btn-edit" onclick="editDevice('${dev.serial_number}')"><i class="fas fa-edit"></i></button><button class="btn-danger" onclick="deleteEntity('devices', '${dev.serial_number}')"><i class="fas fa-trash"></i></button></td></tr>`;
    });
}

async function editDevice(serial) {
    const res = await fetch(`${API_URL}/devices`);
    const data = await res.json();
    const device = data.find(d => d.serial_number === serial);
    if (device) {
        document.getElementById('dev-serial').value = device.serial_number;
        document.getElementById('dev-cpf').value = device.customer_cpf;
        document.getElementById('dev-tipo').value = device.type;
        document.getElementById('dev-serial').disabled = true;
        editingDeviceSerial = serial;
        document.getElementById('form-dispositivo').classList.add('active');
        window.scrollTo(0, 0);
    }
}

async function saveDevice(e) {
    e.preventDefault();
    const customer_cpf = document.getElementById('dev-cpf').value;
    const type = document.getElementById('dev-tipo').value;
    const serial_number = document.getElementById('dev-serial').value;

    const method = editingDeviceSerial ? 'PUT' : 'POST';
    const url = editingDeviceSerial ? `${API_URL}/devices/${editingDeviceSerial}` : `${API_URL}/devices`;

    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial_number, customer_cpf, type })
    });

    if (response.ok) {
        alert('Dispositivo salvo!');
        toggleForm('form-dispositivo');
        fetchDispositivos();
    }
}

// --- ORDENS DE SERVIÇO (REVISADO) ---
async function fetchOS() {
    const res = await fetch(`${API_URL}/service-orders?t=${new Date().getTime()}`);
    const data = await res.json();
    const tbody = document.querySelector('#table-os tbody');
    tbody.innerHTML = '';

    data.forEach(os => {
        const dataAbertura = new Date(os.opening_date).toLocaleDateString('pt-BR');
        
        // Pega apenas o último relato para a tabela não ficar gigante
        const partes = os.problem_description.split('---');
        const ultimoRelato = partes[partes.length - 1].trim();

        tbody.innerHTML += `
            <tr>
                <td>${os.id}</td>
                <td>${os.customer_cpf}</td>
                <td>${os.device_serial}</td>
                <td>${os.technician}</td>
                <td>${dataAbertura}</td>
                <td><span class="badge ${os.status === 'Finalizada' ? 'bg-success' : 'bg-warning text-dark'}">${os.status}</span></td>
                <td>
                    <button class="btn-edit" onclick="editOS(${os.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-danger" onclick="deleteEntity('service-orders', ${os.id})"><i class="fas fa-trash"></i></button>
                </td>
                <td class="texto-truncado" title="${os.problem_description}">${ultimoRelato}</td>
            </tr>`;
    });
}

async function editOS(id) {
    const res = await fetch(`${API_URL}/service-orders`);
    const data = await res.json();
    const os = data.find(o => o.id === id);

    if (os) {
        editingOSId = id;
        document.getElementById('os-cpf').value = os.customer_cpf;
        document.getElementById('os-serial').value = os.device_serial;
        document.getElementById('os-tecnico').value = os.technician;
        document.getElementById('os-status').value = os.status;
        document.getElementById('os-historico-problema').value = os.problem_description;
        document.getElementById('os-data').value = os.opening_date.split('T')[0];

        // Bloqueia campos que não devem mudar na edição
        document.getElementById('os-cpf').disabled = true;
        document.getElementById('os-serial').disabled = true;

        // Histórico
        const histDiv = document.getElementById('os-historico-problema');
        histDiv.innerText = os.problem_description;
        histDiv.style.display = 'block';
        document.getElementById('label-historico').style.display = 'block';

        // Limpa campo de novo problema
        document.getElementById('os-problema').value = '';
        
        document.getElementById('form-os').classList.add('active');
        window.scrollTo(0, 0);
    }
}

async function saveOS(e) {
    e.preventDefault();
    const novoRelato = document.getElementById('os-problema').value;
    const historicoVelho = document.getElementById('os-historico-problema').innerText;

    // Concatena se for edição, senão usa apenas o novo
    const descricaoFinal = editingOSId 
        ? `${historicoVelho}\n--- Atualizado em ${new Date().toLocaleDateString('pt-BR')} ---\n${novoRelato}` 
        : novoRelato;

    const payload = {
        customer_cpf: document.getElementById('os-cpf').value,
        device_serial: document.getElementById('os-serial').value,
        technician: document.getElementById('os-tecnico').value,
        opening_date: document.getElementById('os-data').value,
        problem_description: descricaoFinal,
        status: document.getElementById('os-status').value
    };

    const method = editingOSId ? 'PUT' : 'POST';
    const url = editingOSId ? `${API_URL}/service-orders/${editingOSId}` : `${API_URL}/service-orders`;

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert('Ordem de Serviço salva!');
            toggleForm('form-os');
            await fetchOS(); // Espera atualizar a tabela
            loadDashboard();
        } else {
            const err = await response.json();
            alert("Erro: " + err.error);
        }
    } catch (error) {
        alert('Erro de conexão.');
    }
}

async function deleteEntity(route, id) {
    if(confirm('Tem certeza?')) {
        await fetch(`${API_URL}/${route}/${id}`, { method: 'DELETE' });
        loadData(route === 'devices' ? 'dispositivos' : 'os');
    }
}

async function loadDashboard() {
    const res = await fetch(`${API_URL}/service-orders?t=${new Date().getTime()}`);
    const data = await res.json();
    document.getElementById('count-todo').innerText = data.filter(os => os.status === 'A Realizar').length;
    document.getElementById('count-progress').innerText = data.filter(os => os.status === 'Em Andamento').length;
    document.getElementById('count-done').innerText = data.filter(os => os.status === 'Finalizada').length;
}

//TESTE//

loadDashboard();