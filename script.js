document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search");
    const searchButton = document.getElementById("search-button");
    const searchError = document.getElementById("search-error");
    const loading = document.getElementById("loading");
    const resultDiv = document.getElementById("result");
    const resultContent = document.getElementById("result-content");
    let accessToken = null; // Variável para armazenar o token de acesso

    // Função para validar o input
    function validateInput(value) {
        const cnpjCpfRegex = /^\d{11,14}$/; // CNPJ ou CPF (11 ou 14 dígitos)
        const codeRegex = /^[0-9]{1,5}$/; // Código de cliente (até 5 dígitos)
        if (cnpjCpfRegex.test(value) || codeRegex.test(value)) {
            return true;
        }
        return false;
    }

    // Função para formatar CNPJ/CPF
    function formatCNPJCPF(value) {
        if (value.length === 11) {
            // Formata CPF: XXX.XXX.XXX-XX
            return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        } else if (value.length === 14) {
            // Formata CNPJ: XX.XXX.XXX/XXXX-XX
            return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        }
        return value; // Retorna o valor sem formatação se não for CPF ou CNPJ
    }

    // Função para calcular dias desde uma data
    function calculateDaysSinceDate(dateString) {
        if (!dateString) return null;
        const today = new Date();
        const targetDate = new Date(dateString.split("T")[0]); // Ignora a parte da hora
        const diffTime = Math.abs(today - targetDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    // Função para autenticar e obter o token
    async function authenticateAndGetToken() {
        const loginEndpoint = "http://jnfinfo-001-site3.ntempurl.com/api/auth/login";
        const credentials = {
            username: "admin",
            password: "123456"
        };
        try {
            const response = await fetch(loginEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(credentials)
            });
            if (!response.ok) {
                throw new Error("Falha na autenticação. Verifique suas credenciais.");
            }
            const data = await response.json();
            accessToken = data.token; // Armazena o token
        } catch (error) {
            throw error;
        }
    }

    // Função para buscar dados na API de clientes
    async function fetchClientData(query) {
        if (!accessToken) {
            await authenticateAndGetToken(); // Autentica se o token não estiver disponível
        }
        const clientEndpoint = `http://jnfinfo-001-site3.ntempurl.com/api/clientes`;
        try {
            const response = await fetch(clientEndpoint, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`
                }
            });
            if (!response.ok) {
                throw new Error(`Erro ao consultar a API de clientes (${response.status} ${response.statusText}).`);
            }
            const data = await response.json();
            if (!data || data.length === 0) {
                throw new Error("Nenhum cliente encontrado.");
            }
            // Filtra o cliente correspondente ao CNPJ/CPF ou código de cliente
            const client = data.find(
                client =>
                    client.cgcent === query || // Busca pelo CNPJ/CPF
                    client.codcli.toString() === query // Busca pelo código de cliente
            );
            if (!client) {
                throw new Error("Cliente não encontrado.");
            }
            return client;
        } catch (error) {
            throw error;
        }
    }

    // Função para exibir o resultado
    function displayResult(clientData) {
        // Formata o CNPJ/CPF para exibição
        const formattedCNPJCPF = formatCNPJCPF(clientData.cgcent);
        // Calcula os dias desde a última compra
        const daysSinceLastPurchase = calculateDaysSinceDate(clientData.dtultcomp);
        // Define o status com base nos dias desde a última compra
        const status = daysSinceLastPurchase !== null && daysSinceLastPurchase <= 30 ? "Ativo" : "Inativo";
        // Monta o conteúdo do resultado
        let resultHTML = `
            <p><strong>Status:</strong> ${status}</p>
            <p><strong>CNPJ/CPF:</strong> ${formattedCNPJCPF || "N/A"}</p>
            <p><strong>Código Cliente:</strong> ${clientData.codcli || "N/A"}</p>
            <p><strong>Nome/Razão Social:</strong> ${clientData.nome || "N/A"}</p>
        `;
        // Adiciona a data da última compra apenas se o cliente estiver inativo
        if (status === "Inativo") {
            resultHTML += `<p><strong>Última Compra:</strong> ${formatDate(clientData.dtultcomp)} (${daysSinceLastPurchase} dia(s) atrás)</p>`;
            resultHTML += `<button id="request-transfer-btn">Solicitar Transferência</button>`;
        }
        resultContent.innerHTML = resultHTML;
        resultDiv.classList.remove("error");
        resultDiv.classList.add("success");
        resultDiv.style.display = "block";
        // Adiciona o evento ao botão "Solicitar Transferência"
        if (status === "Inativo") {
            const requestTransferBtn = document.getElementById("request-transfer-btn");
            requestTransferBtn.addEventListener("click", () => {
                openTransferForm(clientData);
            });
        }
    }

    // Função para abrir o formulário de solicitação de transferência
    function openTransferForm(clientData) {
        const formattedCNPJCPF = formatCNPJCPF(clientData.cgcent);
        // Verifica se o formulário já existe
        const existingForm = document.getElementById("transfer-form");
        if (existingForm) {
            existingForm.remove(); // Remove o formulário anterior, se existir
        }
        // Cria o formulário dinamicamente
        const formHTML = `
            <div id="transfer-form">
                <h3>Solicitar Transferência</h3>
                <p><strong>CNPJ/CPF:</strong> ${formattedCNPJCPF}</p>
                <p><strong>Código Cliente:</strong> ${clientData.codcli}</p>
                <p><strong>Nome/Razão Social:</strong> ${clientData.nome}</p>
                <label for="new-seller">Novo Vendedor (Código ou Nome):</label>
                <input type="text" id="new-seller" placeholder="Ex.: João Silva ou 12345" required>
                <label for="requester-name">Responsável pela Solicitação:</label>
                <input type="text" id="requester-name" placeholder="Ex.: Maria Souza" required>
                <button id="submit-transfer-btn">Enviar Solicitação</button>
            </div>
        `;
        resultContent.insertAdjacentHTML("beforeend", formHTML);
        // Adiciona o evento ao botão de envio
        const submitTransferBtn = document.getElementById("submit-transfer-btn");
        submitTransferBtn.addEventListener("click", async () => {
            const newSeller = document.getElementById("new-seller").value;
            const requesterName = document.getElementById("requester-name").value;
            if (!newSeller || !requesterName) {
                alert("Por favor, preencha todos os campos.");
                return;
            }
            // Prepara os dados para enviar à API de mensagens
            const messageBody = `
                Solicitação de Transferência:
                - CNPJ/CPF: ${formattedCNPJCPF}
                - Código Cliente: ${clientData.codcli}
                - Nome/Razão Social: ${clientData.nome}
                - Novo Vendedor: ${newSeller}
                - Responsável pela Solicitação: ${requesterName}
            `;
            try {
                await sendWhatsAppMessage(messageBody);
                alert("Solicitação enviada com sucesso!");
                document.getElementById("transfer-form").remove(); // Remove o formulário após o envio
            } catch (error) {
                alert("Erro ao enviar a solicitação. Por favor, tente novamente.");
                console.error(error);
            }
        });
    }

    // Função para enviar mensagem via API do WhatsApp (usando o formato sugerido)
    async function sendWhatsAppMessage(messageBody) {
        const whatsappApiUrl = "https://api.wts.chat/chat/v1/message/send";
        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/*+json',
                Authorization: 'Bearer pn_u9vRIcHP9k7wDDDh0ggbLMN12TU6PZUt4btAfqQVHDE'
            },
            body: JSON.stringify({
                body: { text: messageBody },
                from: "553121047750",
                to: "5531997906472"
            })
        };
    
        try {
            const response = await fetch(whatsappApiUrl, options);
    
            if (!response.ok) {
                const errorDetails = await response.json(); // Captura detalhes do erro
                throw new Error(`Erro ao enviar mensagem (${response.status} ${response.statusText}): ${JSON.stringify(errorDetails)}`);
            }
    
            const data = await response.json();
            console.log("Mensagem enviada com sucesso:", data);
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error.message);
            alert("Ocorreu um erro ao enviar a solicitação. Por favor, tente novamente.");
        }
    }

    // Função para formatar data
    function formatDate(dateString) {
        if (!dateString) return "Sem histórico de compras";
        // Extrai apenas a parte da data (YYYY-MM-DD)
        const date = new Date(dateString.split("T")[0]);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Função para exibir erro
    function displayError(message) {
        resultContent.innerHTML = `<p>${message}</p>`;
        resultDiv.classList.remove("success");
        resultDiv.classList.add("error");
        resultDiv.style.display = "block";
    }

    // Evento de clique no botão de consulta
    searchButton.addEventListener("click", async () => {
        const query = searchInput.value.trim();
        // Limpa mensagens de erro anteriores
        searchError.style.display = "none";
        resultDiv.style.display = "none";
        // Valida o input
        if (!validateInput(query)) {
            searchError.style.display = "block";
            return;
        }
        // Exibe o carregamento
        loading.style.display = "block";
        try {
            // Busca os dados do cliente
            const clientData = await fetchClientData(query);
            // Exibe o resultado final
            displayResult(clientData);
        } catch (error) {
            displayError(error.message);
        } finally {
            // Esconde o carregamento
            loading.style.display = "none";
        }
    });

    // Evento para limpar mensagens de erro ao digitar
    searchInput.addEventListener("input", () => {
        searchError.style.display = "none";
    });
});