document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search");
    const searchButton = document.getElementById("search-button");
    const searchError = document.getElementById("search-error");
    const loading = document.getElementById("loading");
    const resultDiv = document.getElementById("result");
    const resultContent = document.getElementById("result-content");
    let accessToken = null;

    // Configuração do Proxy
    const PROXY_URL = "https://proxy-t90l.onrender.com";

    // Função para validar o input
    function validateInput(value) {
        const cnpjCpfRegex = /^\d{11,14}$/;
        const codeRegex = /^[0-9]{1,5}$/;
        return cnpjCpfRegex.test(value) || codeRegex.test(value);
    }

    // Função para formatar CNPJ/CPF
    function formatCNPJCPF(value) {
        if (value.length === 11) {
            return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        } else if (value.length === 14) {
            return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        }
        return value;
    }

    // Função para calcular dias desde uma data
    function calculateDaysSinceDate(dateString) {
        if (!dateString) return null;
        const today = new Date();
        const targetDate = new Date(dateString.split("T")[0]);
        return Math.ceil(Math.abs(today - targetDate) / (1000 * 60 * 60 * 24));
    }

    // Função para formatar data
    function formatDate(dateString) {
        if (!dateString) return "Sem histórico de compras";
        const date = new Date(dateString.split("T")[0]);
        return date.toLocaleDateString('pt-BR');
    }

    // Autenticação via Proxy
    async function authenticateAndGetToken() {
        try {
            const response = await fetch(`${PROXY_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: "admin",
                    password: "123456"
                })
            });
            
            if (!response.ok) {
                throw new Error("Falha na autenticação");
            }
            
            const data = await response.json();
            accessToken = data.token;
        } catch (error) {
            console.error("Erro de autenticação:", error);
            throw new Error("Não foi possível conectar ao serviço");
        }
    }

    // Busca de clientes via Proxy
    async function fetchClientData(query) {
        if (!accessToken) {
            await authenticateAndGetToken();
        }

        try {
            const response = await fetch(`${PROXY_URL}/api/clientes`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Erro na consulta: ${response.status}`);
            }

            const data = await response.json();
            const client = data.find(c => 
                c.cgcent === query || 
                c.codcli.toString() === query
            );

            if (!client) {
                throw new Error("Cliente não encontrado");
            }

            return client;
        } catch (error) {
            console.error("Erro na busca:", error);
            throw error;
        }
    }

    // Função para criar o formulário de transferência (única instância)
    function createTransferForm(clientData) {
        // Remove qualquer formulário existente
        const existingForm = document.getElementById('transfer-form');
        if (existingForm) {
            existingForm.remove();
        }

        const formHTML = `
            <div id="transfer-form" style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                <h3 style="margin-top: 0; font-size: 1.1rem;">Solicitar Transferência</h3>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9rem;">Solicitante</label>
                    <input type="text" id="solicitante" style="width: 100%; padding: 8px; box-sizing: border-box; font-size: 0.9rem;" placeholder="Nome do solicitante">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9rem;">Novo Representante</label>
                    <input type="text" id="novo-representante" style="width: 100%; padding: 8px; box-sizing: border-box; font-size: 0.9rem;" placeholder="Nome do novo representante">
                </div>
                <button id="send-transfer-btn" style="padding: 8px 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">Enviar Solicitação</button>
                <button id="cancel-transfer-btn" style="padding: 8px 15px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px; font-size: 0.9rem;">Cancelar</button>
            </div>
        `;
        
        resultContent.insertAdjacentHTML('beforeend', formHTML);
        
        // Adiciona eventos aos botões
        document.getElementById('send-transfer-btn').addEventListener('click', () => {
            sendTransferRequest(clientData);
        });
        
        document.getElementById('cancel-transfer-btn').addEventListener('click', () => {
            document.getElementById('transfer-form').remove();
            // Reativa o botão principal após cancelar
            const mainBtn = document.getElementById("request-transfer-btn");
            if (mainBtn) {
                mainBtn.disabled = false;
                mainBtn.addEventListener("click", handleTransferClick);
            }
        });
    }

    // Função para enviar a solicitação via WhatsApp
    function sendTransferRequest(clientData) {
        const solicitante = document.getElementById('solicitante').value.trim();
        const novoRepresentante = document.getElementById('novo-representante').value.trim();
        
        if (!solicitante || !novoRepresentante) {
            alert('Por favor, preencha todos os campos');
            return;
        }
        
        const formattedCNPJCPF = formatCNPJCPF(clientData.cgcent);
        const whatsappNumber = '5531997906472';
        
        const message = `*SOLICITAÇÃO DE TRANSFERÊNCIA DE REPRESENTANTE*

*CNPJ:* ${formattedCNPJCPF}
*Razão Social:* ${clientData.nome}
*Código Cliente:* ${clientData.codcli}
*Solicitante:* ${solicitante}
*Novo Representante:* ${novoRepresentante}`;
        
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
        
        window.open(whatsappUrl, '_blank');
        
        // Remove o formulário após envio
        document.getElementById('transfer-form').remove();
        
        // Reativa o botão principal após envio
        const mainBtn = document.getElementById("request-transfer-btn");
        if (mainBtn) {
            mainBtn.disabled = false;
            mainBtn.addEventListener("click", handleTransferClick);
        }
    }

    // Função para lidar com o clique no botão de transferência
    function handleTransferClick() {
        const clientData = JSON.parse(this.getAttribute('data-client'));
        this.disabled = true;
        createTransferForm(clientData);
    }

    // Exibe os resultados
    function displayResult(clientData) {
        const formattedCNPJCPF = formatCNPJCPF(clientData.cgcent);
        const daysSinceLastPurchase = calculateDaysSinceDate(clientData.dtultcomp);
        const isActive = daysSinceLastPurchase !== null && daysSinceLastPurchase <= 30;
        
        // Limpa classes de status anteriores
        resultDiv.classList.remove("active-status", "inactive-status");
        
        // Adiciona classe de status apropriada
        if (isActive) {
            resultDiv.classList.add("active-status");
        } else {
            resultDiv.classList.add("inactive-status");
        }

        let resultHTML = `
            <p><strong>Status:</strong> ${isActive ? "Ativo" : "Inativo"}</p>
            <p><strong>CNPJ:</strong> ${formattedCNPJCPF}</p>
            <p><strong>Código:</strong> ${clientData.codcli}</p>
            <p><strong>Razão Social:</strong> ${clientData.nome}</p>
            <p><strong>Última Compra:</strong> 
            ${formatDate(clientData.dtultcomp)} (${daysSinceLastPurchase} dias atrás)</p>
        `;

        if (isActive) {
            resultHTML += `
                <button id="request-transfer-btn" disabled style="background-color: #cccccc; cursor: not-allowed;">Solicitar Transferência</button>
                <div class="transfer-alert" style="margin-top: 15px;">
                    <i>⚠️</i>
                    <span>Transferência proibida para clientes ativos</span>
                </div>
            `;
        } else {
            resultHTML += `
                <button id="request-transfer-btn">Solicitar Transferência</button>
            `;
        }

        resultContent.innerHTML = resultHTML;
        resultDiv.classList.remove("error");
        resultDiv.classList.add("success");
        resultDiv.style.display = "block";

        // Armazena os dados do cliente no botão
        const requestBtn = document.getElementById("request-transfer-btn");
        if (requestBtn && !isActive) {
            requestBtn.setAttribute('data-client', JSON.stringify(clientData));
            requestBtn.addEventListener("click", handleTransferClick);
        }
    }

    // Exibe mensagens de erro
    function displayError(message) {
        resultContent.innerHTML = `<p>${message}</p>`;
        resultDiv.classList.remove("success", "active-status", "inactive-status");
        resultDiv.classList.add("error");
        resultDiv.style.display = "block";
    }

    // Evento de busca
    searchButton.addEventListener("click", async () => {
        const query = searchInput.value.trim();
        
        searchError.style.display = "none";
        resultDiv.style.display = "none";
        
        if (!validateInput(query)) {
            searchError.style.display = "block";
            return;
        }
        
        loading.style.display = "block";
        
        try {
            const clientData = await fetchClientData(query);
            displayResult(clientData);
        } catch (error) {
            displayError(error.message);
        } finally {
            loading.style.display = "none";
        }
    });

    // Limpa erros ao digitar
    searchInput.addEventListener("input", () => {
        searchError.style.display = "none";
    });

    // Permite busca com Enter
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            searchButton.click();
        }
    });
});