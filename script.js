document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search");
    const searchButton = document.getElementById("search-button");
    const searchError = document.getElementById("search-error");
    const loading = document.getElementById("loading");
    const resultDiv = document.getElementById("result");
    const resultContent = document.getElementById("result-content");
    let accessToken = null;

    // Configuração do Proxy - Substitua pela sua URL do Render
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

    // Exibe os resultados
    function displayResult(clientData) {
        const formattedCNPJCPF = formatCNPJCPF(clientData.cgcent);
        const daysSinceLastPurchase = calculateDaysSinceDate(clientData.dtultcomp);
        const status = daysSinceLastPurchase !== null && daysSinceLastPurchase <= 30 ? "Ativo" : "Inativo";

        let resultHTML = `
            <p><strong>Status:</strong> ${status}</p>
            <p><strong>CNPJ/CPF:</strong> ${formattedCNPJCPF}</p>
            <p><strong>Código:</strong> ${clientData.codcli}</p>
            <p><strong>Nome:</strong> ${clientData.nome}</p>
        `;

        if (status === "Inativo") {
            resultHTML += `
                <p><strong>Última Compra:</strong> 
                ${formatDate(clientData.dtultcomp)} (${daysSinceLastPurchase} dias atrás)</p>
                <button id="request-transfer-btn">Solicitar Transferência</button>
            `;
        }

        resultContent.innerHTML = resultHTML;
        resultDiv.classList.remove("error");
        resultDiv.classList.add("success");
        resultDiv.style.display = "block";

        if (status === "Inativo") {
            document.getElementById("request-transfer-btn").addEventListener("click", () => {
                alert("Funcionalidade de transferência desativada nesta versão");
            });
        }
    }

    // Exibe mensagens de erro
    function displayError(message) {
        resultContent.innerHTML = `<p>${message}</p>`;
        resultDiv.classList.remove("success");
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
});