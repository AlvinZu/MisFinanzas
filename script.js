document.addEventListener('DOMContentLoaded', () => {

    // --- REGISTRO DEL SERVICE WORKER para la funcionalidad PWA ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('Service Worker registrado con éxito:', registration);
            })
            .catch(error => {
                console.log('Error al registrar el Service Worker:', error);
            });
    }
    
    // --- SELECCIÓN DE ELEMENTOS DEL DOM ---
    const views = document.querySelectorAll('.view');
    const navButtons = document.querySelectorAll('.nav-btn');
    const periodSelector = document.getElementById('period-selector');
    
    // Elementos del Modal
    const transactionModal = document.getElementById('transaction-modal');
    const openModalBtn = document.getElementById('add-transaction-fab');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const transactionForm = document.getElementById('transaction-form');
    const modalTitle = document.getElementById('modal-title');
    const transactionIdInput = document.getElementById('transaction-id');
    const categorySelect = document.getElementById('categoria');
    const typeRadios = document.querySelectorAll('input[name="tipo"]');
    
    // Elementos de categorías
    const addCategoryForm = document.getElementById('add-category-form');
    
    // Chart
    let expenseChart = null;

    // --- ESTADO INICIAL DE LA APLICACIÓN ---
    const appState = {
        transactions: JSON.parse(localStorage.getItem('finanzas_transacciones')) || [],
        categories: JSON.parse(localStorage.getItem('finanzas_categorias')) || [
            // Categorías por defecto
            { nombre: "Comida", tipo: "gasto" },
            { nombre: "Transporte", tipo: "gasto" },
            { nombre: "Salario", tipo: "ingreso" },
            { nombre: "Ventas", tipo: "ingreso" }
        ],
    };

    // --- FUNCIONES DE MANEJO DE DATOS (localStorage) ---

    /**
     * Guarda las transacciones en localStorage y vuelve a renderizar la UI.
     */
    const saveTransactions = () => {
        localStorage.setItem('finanzas_transacciones', JSON.stringify(appState.transactions));
        render();
    };

    /**
     * Guarda las categorías en localStorage y vuelve a renderizar la UI.
     */
    const saveCategories = () => {
        localStorage.setItem('finanzas_categorias', JSON.stringify(appState.categories));
        render();
    };

    // --- FUNCIONES DE RENDERIZADO Y ACTUALIZACIÓN DE UI ---

    /**
     * Renderiza todas las partes dinámicas de la aplicación.
     * Es la función principal de actualización.
     */
    const render = () => {
        renderDashboard();
        renderCategoriesView();
        renderAnalysisChart();
    };

    /**
     * Renderiza el panel principal: tarjetas de resumen y lista de transacciones.
     */
    const renderDashboard = () => {
        const filteredTransactions = getFilteredTransactions();
        
        const totalIncome = filteredTransactions
            .filter(t => t.tipo === 'ingreso')
            .reduce((sum, t) => sum + t.monto, 0);

        const totalExpense = filteredTransactions
            .filter(t => t.tipo === 'gasto')
            .reduce((sum, t) => sum + t.monto, 0);
            
        const balance = totalIncome - totalExpense;

        document.getElementById('total-income').textContent = formatCurrency(totalIncome);
        document.getElementById('total-expense').textContent = formatCurrency(totalExpense);
        
        const balanceEl = document.getElementById('month-balance');
        balanceEl.textContent = formatCurrency(balance);
        balanceEl.style.color = balance >= 0 ? 'var(--income-color)' : 'var(--expense-color)';
        
        renderTransactionsList(filteredTransactions);
    };

    /**
     * Muestra la lista de transacciones en el panel principal.
     * @param {Array} transactions - La lista de transacciones a mostrar.
     */
    const renderTransactionsList = (transactions) => {
        const listEl = document.getElementById('transactions-list');
        listEl.innerHTML = '';

        if (transactions.length === 0) {
            listEl.innerHTML = '<p>No hay transacciones en este período.</p>';
            return;
        }
        
        // Ordenar transacciones por fecha, de más reciente a más antigua
        const sortedTransactions = transactions.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        sortedTransactions.forEach(t => {
            const item = document.createElement('div');
            item.className = 'transaction-item';
            item.innerHTML = `
                <div class="transaction-item-info">
                    <p>${t.categoria} ${t.descripcion ? `- <em>${t.descripcion}</em>` : ''}</p>
                    <p>${new Date(t.fecha).toLocaleDateString()}</p>
                </div>
                <div class="transaction-item-amount ${t.tipo === 'ingreso' ? 'income' : 'expense'}">
                    ${t.tipo === 'ingreso' ? '+' : '-'} ${formatCurrency(t.monto)}
                </div>
                <div class="transaction-item-actions">
                    <button class="edit-btn" data-id="${t.id}" aria-label="Editar"><i class="ph ph-pencil-simple"></i></button>
                    <button class="delete-btn" data-id="${t.id}" aria-label="Eliminar"><i class="ph ph-trash"></i></button>
                </div>
            `;
            listEl.appendChild(item);
        });
    };
    
    /**
     * Renderiza la vista de gestión de categorías.
     */
    const renderCategoriesView = () => {
        const incomeList = document.getElementById('income-categories-list');
        const expenseList = document.getElementById('expense-categories-list');
        incomeList.innerHTML = '';
        expenseList.innerHTML = '';

        appState.categories.forEach(cat => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${cat.nombre}</span>
                <button class="delete-category-btn" data-nombre="${cat.nombre}" data-tipo="${cat.tipo}" aria-label="Eliminar categoría ${cat.nombre}"><i class="ph ph-x"></i></button>
            `;
            if (cat.tipo === 'ingreso') {
                incomeList.appendChild(li);
            } else {
                expenseList.appendChild(li);
            }
        });
    };

    /**
     * Renderiza el gráfico de análisis de gastos.
     */
    const renderAnalysisChart = () => {
        const filteredTransactions = getFilteredTransactions();
        const expenseData = filteredTransactions.filter(t => t.tipo === 'gasto');
        const chartNoDataEl = document.getElementById('chart-no-data');

        if (expenseData.length === 0) {
            chartNoDataEl.classList.remove('hidden');
            if (expenseChart) expenseChart.destroy();
            expenseChart = null; // Destruir el gráfico si no hay datos
            return;
        } else {
            chartNoDataEl.classList.add('hidden');
        }

        const dataByCat = expenseData.reduce((acc, t) => {
            if (!acc[t.categoria]) {
                acc[t.categoria] = 0;
            }
            acc[t.categoria] += t.monto;
            return acc;
        }, {});
        
        const labels = Object.keys(dataByCat);
        const data = Object.values(dataByCat);

        const ctx = document.getElementById('expense-chart').getContext('2d');
        
        if (expenseChart) {
            expenseChart.destroy(); // Destruir el gráfico anterior para evitar solapamientos
        }
        
        expenseChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Gastos por Categoría',
                    data: data,
                    backgroundColor: [ // Paleta de colores para el gráfico
                        '#e74c3c', '#3498db', '#9b59b6', '#f1c40f',
                        '#2ecc71', '#e67e22', '#1abc9c', '#34495e'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += formatCurrency(context.parsed);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    };

    // --- FUNCIONES DE UTILIDAD ---
    
    /**
     * Formatea un número como moneda (USD como ejemplo, se puede adaptar).
     * @param {number} amount - El monto a formatear.
     * @returns {string} El monto formateado como cadena.
     */
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    /**
     * Filtra las transacciones según el período seleccionado en el dropdown.
     * @returns {Array} Un array con las transacciones filtradas.
     */
    const getFilteredTransactions = () => {
        const period = periodSelector.value;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        switch(period) {
            case 'currentMonth':
                return appState.transactions.filter(t => new Date(t.fecha) >= startOfMonth && new Date(t.fecha) <= endOfMonth);
            case 'lastMonth':
                return appState.transactions.filter(t => new Date(t.fecha) >= startOfLastMonth && new Date(t.fecha) <= endOfLastMonth);
            case 'currentYear':
                return appState.transactions.filter(t => new Date(t.fecha) >= startOfYear);
            case 'all':
            default:
                return appState.transactions;
        }
    };
    
    /**
     * Popula el <select> de categorías en el formulario de transacción.
     * @param {string} type - 'ingreso' o 'gasto' para filtrar las categorías.
     */
    const populateCategorySelect = (type) => {
        categorySelect.innerHTML = '';
        appState.categories
            .filter(cat => cat.tipo === type)
            .forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.nombre;
                option.textContent = cat.nombre;
                categorySelect.appendChild(option);
            });
    };

    // --- MANEJO DE EVENTOS ---
    
    // Cambiar de vista con la barra de navegación
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetViewId = button.dataset.view;
            
            views.forEach(view => view.classList.remove('active'));
            document.getElementById(targetViewId).classList.add('active');

            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

    // Abrir y cerrar el modal de transacción
    openModalBtn.addEventListener('click', () => {
        transactionForm.reset();
        modalTitle.textContent = 'Nueva Transacción';
        transactionIdInput.value = '';
        document.getElementById('fecha').valueAsDate = new Date();
        populateCategorySelect('gasto');
        transactionModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => {
        transactionModal.classList.add('hidden');
    });

    window.addEventListener('click', (e) => {
        if (e.target === transactionModal) {
            transactionModal.classList.add('hidden');
        }
    });

    // Actualizar categorías en el select cuando cambia el tipo (ingreso/gasto)
    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            populateCategorySelect(e.target.value);
        });
    });

    // Guardar o actualizar una transacción
    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const id = transactionIdInput.value;
        const newTransaction = {
            id: id ? parseInt(id) : Date.now(),
            tipo: document.querySelector('input[name="tipo"]:checked').value,
            monto: parseFloat(document.getElementById('monto').value),
            categoria: document.getElementById('categoria').value,
            fecha: document.getElementById('fecha').value,
            descripcion: document.getElementById('descripcion').value.trim()
        };

        if (id) { // Actualizando una existente
            const index = appState.transactions.findIndex(t => t.id === parseInt(id));
            if (index !== -1) {
                appState.transactions[index] = newTransaction;
            }
        } else { // Creando una nueva
            appState.transactions.push(newTransaction);
        }
        
        saveTransactions();
        transactionModal.classList.add('hidden');
    });

    // Delegación de eventos para editar y eliminar transacciones
    document.getElementById('transactions-list').addEventListener('click', e => {
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            const id = parseInt(editBtn.dataset.id);
            const transaction = appState.transactions.find(t => t.id === id);
            
            modalTitle.textContent = 'Editar Transacción';
            transactionIdInput.value = transaction.id;
            document.querySelector(`input[name="tipo"][value="${transaction.tipo}"]`).checked = true;
            document.getElementById('monto').value = transaction.monto;
            document.getElementById('fecha').value = transaction.fecha;
            document.getElementById('descripcion').value = transaction.descripcion;

            populateCategorySelect(transaction.tipo);
            document.getElementById('categoria').value = transaction.categoria;

            transactionModal.classList.remove('hidden');
        }
        
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            const id = parseInt(deleteBtn.dataset.id);
            if (confirm('¿Estás seguro de que quieres eliminar esta transacción?')) {
                appState.transactions = appState.transactions.filter(t => t.id !== id);
                saveTransactions();
            }
        }
    });
    
    // Agregar nueva categoría
    addCategoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('category-name');
        const typeSelect = document.getElementById('category-type');
        
        const newCategory = {
            nombre: nameInput.value.trim(),
            tipo: typeSelect.value
        };

        if (newCategory.nombre && !appState.categories.some(c => c.nombre.toLowerCase() === newCategory.nombre.toLowerCase() && c.tipo === newCategory.tipo)) {
            appState.categories.push(newCategory);
            saveCategories();
            nameInput.value = '';
        } else {
            alert('El nombre de la categoría no puede estar vacío o ya existe.');
        }
    });

    // Eliminar categoría
    document.querySelector('.category-lists').addEventListener('click', e => {
        const deleteBtn = e.target.closest('.delete-category-btn');
        if (deleteBtn) {
            const nombre = deleteBtn.dataset.nombre;
            const tipo = deleteBtn.dataset.tipo;
            
            if (confirm(`¿Estás seguro de que quieres eliminar la categoría "${nombre}"?`)) {
                // Prevenir eliminación si la categoría está en uso
                const isInUse = appState.transactions.some(t => t.categoria === nombre && t.tipo === tipo);
                if (isInUse) {
                    alert('No puedes eliminar una categoría que está siendo utilizada en alguna transacción.');
                    return;
                }

                appState.categories = appState.categories.filter(c => !(c.nombre === nombre && c.tipo === tipo));
                saveCategories();
            }
        }
    });
    
    // Actualizar UI cuando cambia el período
    periodSelector.addEventListener('change', render);

    // --- INICIALIZACIÓN DE LA APLICACIÓN ---
    render();
});