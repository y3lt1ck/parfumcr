// PARFUM CR - Lógica Principal y Base de Datos
const CART_KEY = 'parfum_cr_cart_v2';
let allProducts = [];
let cartItems = [];
let currentUser = null;
let currentEmail = null;

// Configuración de EmailJS
const EMAILJS_SERVICE_ID = 'service_yt8jfeo';
const EMAILJS_TEMPLATE_CONTACT = 'template_f4af6za';
const EMAILJS_TEMPLATE_ORDER = 'template_2aeitde';

if (typeof emailjs !== 'undefined') {
    emailjs.init("hX0cA7WWN1RPXPi38");
} else {
    console.warn("EmailJS no se cargó (¿bloqueador de anuncios?).");
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadCartFromStorage();
    setupAuthListeners();
    fetchProductsFromDB();
    setupEventListeners();
});

// === TEMA OSCURO / CLARO ===
function initTheme() {
    const isDark = localStorage.getItem('parfum_dark_mode') === 'true';
    const toggle = document.getElementById('theme-toggle-checkbox');
    if (isDark) {
        document.body.classList.add('dark-mode');
        toggle.checked = true;
    }
    toggle.addEventListener('change', (e) => {
        if(e.target.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('parfum_dark_mode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('parfum_dark_mode', 'false');
        }
    });
}

// === BASE DE DATOS: CARGAR PRODUCTOS DESDE FIREBASE ===
async function fetchProductsFromDB() {
    try {
        const snapshot = await db.collection('products').orderBy('createdAt', 'desc').get();
        let menProducts = [];
        let womenProducts = [];
        allProducts = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id; // ID único generado por Firebase
            allProducts.push(data);

            if(data.category === 'Hombre') menProducts.push(data);
            else if(data.category === 'Mujer') womenProducts.push(data);
        });

        renderProductGrid(menProducts, 'product-grid');
        renderProductGrid(womenProducts, 'product-grid-women');
        updateCartSidebar();
    } catch (error) {
        console.error("Error cargando el catálogo desde Firebase:", error);
    }
}

// === RENDER PRODUCTOS ===
function renderProductGrid(productsToRender, containerId) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    grid.innerHTML = '';
    
    if(productsToRender.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">Aún no hay perfumes registrados en esta categoría.</p>';
        return;
    }

    productsToRender.forEach(product => {
        const card = document.createElement('article');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.imageUrl}" loading="lazy" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>CRC ${product.price.toLocaleString('es-CR')}</p>
            <div class="product-actions">
                <button onclick="openProductModal('${product.id}')">Ver</button>
                <button onclick="addToCart('${product.id}')">Agregar</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// === AUTENTICACIÓN FIREBASE ===
function setupAuthListeners() {
    // Escuchar cambios de sesión
    auth.onAuthStateChanged((user) => {
        const authBtn = document.getElementById('auth-btn');
        const userMenu = document.getElementById('user-menu');
        
        if (user) {
            // Usuario logueado
            currentUser = user.displayName || user.email.split('@')[0];
            currentEmail = user.email;
            authBtn.style.display = 'none';
            userMenu.style.display = 'flex';
            document.getElementById('user-welcome').textContent = `Hola, ${currentUser}`;
        } else {
            // Usuario deslogueado
            currentUser = null;
            currentEmail = null;
            authBtn.style.display = 'block';
            userMenu.style.display = 'none';
        }
    });

    // Login con Email y Contraseña
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        
        auth.signInWithEmailAndPassword(email, pass)
            .then(() => {
                document.getElementById('auth-modal').setAttribute('aria-hidden', 'true');
                document.getElementById('login-error').textContent = '';
                e.target.reset();
            })
            .catch(err => {
                document.getElementById('login-error').textContent = 'Credenciales incorrectas o usuario no existe.';
            });
    });

    // Registro con Email y Contraseña
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;

        try {
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await cred.user.updateProfile({ displayName: username });
            await db.collection('users').doc(cred.user.uid).set({
                username: username,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            currentUser = username;
            document.getElementById('user-welcome').textContent = `Hola, ${username}`;
            document.getElementById('register-error').textContent = '';
            alert('Cuenta creada exitosamente. Has iniciado sesión.');
            document.getElementById('auth-modal').setAttribute('aria-hidden', 'true');
            e.target.reset();
        } catch (err) {
            document.getElementById('register-error').textContent = err.message;
        }
    });

        // Cerrar sesión
    document.getElementById('logout-btn').addEventListener('click', () => {
        auth.signOut();
    });
}

// === BUSCADOR TIEMPO REAL ===
document.getElementById('search-input').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    
    const filteredMen = allProducts.filter(p => p.category === 'Hombre' && p.name.toLowerCase().includes(term));
    const filteredWomen = allProducts.filter(p => p.category === 'Mujer' && p.name.toLowerCase().includes(term));
    
    renderProductGrid(filteredMen, 'product-grid');
    renderProductGrid(filteredWomen, 'product-grid-women');
});

// === CARRITO ===
function loadCartFromStorage() {
    const items = window.localStorage.getItem(CART_KEY);
    cartItems = items ? JSON.parse(items) : [];
}

window.addToCart = function(productId) {
    const idx = cartItems.findIndex(i => i.id === productId);
    if (idx !== -1) cartItems[idx].quantity += 1;
    else cartItems.push({ id: productId, quantity: 1 });
    saveCart();
}

window.changeCartQuantity = function(productId, delta) {
    const idx = cartItems.findIndex(i => i.id === productId);
    if (idx !== -1) {
        cartItems[idx].quantity += delta;
        if (cartItems[idx].quantity <= 0) cartItems.splice(idx, 1);
        saveCart();
    }
}

function saveCart() {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
    updateCartSidebar();
}

function updateCartSidebar() {
    const itemsDiv = document.getElementById('cart-items');
    let total = 0;
    let count = 0;
    itemsDiv.innerHTML = '';

    cartItems.forEach(item => {
        const prod = allProducts.find(p => p.id === item.id);
        if(!prod) return;

        total += prod.price * item.quantity;
        count += item.quantity;
        
        itemsDiv.innerHTML += `
            <div class="cart-item">
                <div style="flex:1"><b>${prod.name}</b><br>CRC ${prod.price.toLocaleString('es-CR')}</div>
                <div class="cart-item-actions">
                    <button onclick="changeCartQuantity('${prod.id}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="changeCartQuantity('${prod.id}', 1)">+</button>
                </div>
            </div>
        `;
    });

    document.getElementById('cart-count').textContent = count;
    document.getElementById('cart-total-items').textContent = count;
    document.getElementById('cart-total-price').textContent = `CRC ${total.toLocaleString('es-CR')}`;
}

// === FACTURACIÓN Y PAGO ===
async function processPayment() {
    if (cartItems.length === 0) {
        alert("El carrito está vacío.");
        return;
    }

    if (!currentUser) {
        alert("Para realizar la compra y generar la factura debes Iniciar Sesión.");
        document.getElementById('cart-sidebar').setAttribute('aria-hidden', 'true');
        openAuthModal();
        return;
    }

    // Armar el pedido con los datos actuales del carrito
    const items = cartItems.map(item => {
        const prod = allProducts.find(p => p.id === item.id);
        return {
            productId: prod.id,
            name: prod.name,
            price: prod.price,
            quantity: item.quantity
        };
    });

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const iva = subtotal * 0.13;
    const total = subtotal + iva;
    const invoiceId = 'FACT-' + Math.random().toString(36).substr(2, 6).toUpperCase();

    const order = {
        invoiceId: invoiceId,
        uid: auth.currentUser.uid,
        customerName: currentUser,
        customerEmail: currentEmail,
        items: items,
        subtotal: subtotal,
        iva: iva,
        total: total,
        paymentMethod: 'Efectivo',
        status: 'Pendiente',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        // 1. Guardar el pedido en Firestore
        await db.collection('orders').add(order);
    } catch (error) {
        console.error("Error guardando el pedido:", error);
        alert("No se pudo registrar tu pedido. Intenta de nuevo.");
        return;
    }

    // 2. Generar la factura PDF
    generatePDFInvoice(order);

    // 3. Notificar al correo del negocio
    const resumen = items.map(i => `${i.quantity}x ${i.name} (CRC ${(i.price * i.quantity).toLocaleString('es-CR')})`).join(', ');
    notifyAdminNewInvoice(invoiceId, currentUser, total, resumen);

    alert(`¡Gracias por tu compra, ${currentUser}! Tu factura ha sido descargada y tu pedido quedó registrado.`);
    cartItems = [];
    saveCart();
    document.getElementById('cart-sidebar').setAttribute('aria-hidden', 'true');
}

function generatePDFInvoice(order) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.text("Parfum CR", 20, 20);
    doc.setFontSize(11);
    doc.text(`ID de Factura: ${order.invoiceId}`, 20, 30);
    doc.text("Email: ventas@parfumcr.com | Tel: +506 8609-1810", 20, 37);
    doc.text(`Cliente: ${order.customerName}`, 20, 47);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 54);

    doc.line(20, 58, 190, 58);

    let y = 68;
    doc.setFontSize(14);
    doc.text("Detalle de Compra:", 20, y);
    y += 10;

    doc.setFontSize(11);
    order.items.forEach(item => {
        doc.text(`${item.quantity}x ${item.name}`, 20, y);
        doc.text(`CRC ${(item.price * item.quantity).toLocaleString('es-CR')}`, 155, y);
        y += 10;
    });

    doc.line(20, y, 190, y);
    y += 10;

    doc.text(`Subtotal: CRC ${order.subtotal.toLocaleString('es-CR')}`, 125, y);
    y += 8;
    doc.text(`IVA (13%): CRC ${order.iva.toLocaleString('es-CR')}`, 125, y);
    y += 8;
    doc.setFontSize(14);
    doc.text(`TOTAL: CRC ${order.total.toLocaleString('es-CR')}`, 125, y);

    doc.save(`${order.invoiceId}.pdf`);
}

function notifyAdminNewInvoice(invoiceId, clientName, totalAmount, detailsText) {
    if (typeof emailjs === 'undefined') return;

    const templateParams = {
        invoice_id: invoiceId,
        client_name: clientName,
        total: `CRC ${totalAmount.toLocaleString('es-CR')}`,
        details: detailsText,
        date: new Date().toLocaleString()
    };

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ORDER, templateParams)
        .then(() => console.log("Notificación enviada."))
        .catch(error => console.error("Error al enviar notificación:", error));
}

// === FORMULARIO CONTACTO (EmailJS) ===
document.getElementById('contact-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const msgDiv = document.getElementById('contact-form-msg');

    if (typeof emailjs === 'undefined') {
        msgDiv.textContent = "No se pudo enviar el mensaje. Intenta de nuevo más tarde.";
        msgDiv.style.color = "red";
        return;
    }

    msgDiv.textContent = "Enviando mensaje...";
    msgDiv.style.color = "var(--text-main)";

    emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CONTACT, this)
        .then(() => {
            msgDiv.textContent = "¡Mensaje enviado con éxito! Te contactaremos pronto.";
            msgDiv.style.color = "green";
            this.reset();
        }, (error) => {
            console.error("Error EmailJS contacto:", error);
            msgDiv.textContent = "Error al enviar. Intenta de nuevo más tarde.";
            msgDiv.style.color = "red";
        });
});

// === LISTENERS Y MODALES ===
function setupEventListeners() {
    document.querySelectorAll('.scroll-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
        });
    });

        document.getElementById('auth-btn').addEventListener('click', openAuthModal);
    document.getElementById('close-auth-btn').addEventListener('click', () => {
        clearAuthErrors();
        document.getElementById('auth-modal').setAttribute('aria-hidden', 'true');
    });

    document.getElementById('show-register').addEventListener('click', () => {
        clearAuthErrors();
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('register-container').style.display = 'block';
    });
    document.getElementById('show-login').addEventListener('click', () => {
        clearAuthErrors();
        document.getElementById('register-container').style.display = 'none';
        document.getElementById('login-container').style.display = 'block';
    });

    document.getElementById('cart-btn').addEventListener('click', () => document.getElementById('cart-sidebar').setAttribute('aria-hidden', 'false'));
    document.getElementById('close-cart-btn').addEventListener('click', () => document.getElementById('cart-sidebar').setAttribute('aria-hidden', 'true'));
    document.getElementById('empty-cart-btn').addEventListener('click', () => { cartItems = []; saveCart(); });
    document.getElementById('pay-cart-btn').addEventListener('click', processPayment);
    
    document.getElementById('close-modal-btn').addEventListener('click', () => document.getElementById('modal-producto').setAttribute('aria-hidden', 'true'));
}

function clearAuthErrors() {
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
}

function openAuthModal() {
    clearAuthErrors();
    document.getElementById('auth-modal').setAttribute('aria-hidden', 'false');
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('register-container').style.display = 'none';
}

window.openProductModal = function(productId) {
    const prod = allProducts.find(p => p.id === productId);
    if(!prod) return;
    
    const detalle = document.getElementById('modal-producto-detalle');
    detalle.innerHTML = `
        <img src="${prod.imageUrl}" loading="lazy" style="width: 100%; border-radius: 8px;">
        <h2>${prod.name}</h2>
        <p>${prod.description}</p>
        <h3 style="color: var(--primary); margin: 1rem 0;">CRC ${prod.price.toLocaleString('es-CR')}</h3>
        <button class="btn-primary" style="width:100%" onclick="addToCart('${prod.id}'); document.getElementById('modal-producto').setAttribute('aria-hidden', 'true');">Agregar al Carrito</button>
    `;
    document.getElementById('modal-producto').setAttribute('aria-hidden', 'false');
}