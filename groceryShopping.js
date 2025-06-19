/**
 * groceryShopping.js
 * This script handles all logic for the Smart Grocery List application.
 * It manages adding items, categorizing them, tracking type, quantity, and price,
 * and handling share/PDF/clear actions.
 */

// --- I. STATE & CONFIGURATION ---

const GROCERY_DATA = {
    "Produce": {
        "pr-a": "Apples", "pr-b": "Bananas", "pr-c": "Carrots", "pr-d": "Broccoli", "pr-e": "Spinach", "pr-f": "Onions", "pr-g": "Potatoes", "pr-h": "Tomatoes", "pr-i": "Lettuce", "pr-j": "Cucumbers", "pr-k": "Bell Peppers", "pr-l": "Avocado", "pr-m": "Garlic"
    },
    "Dairy & Eggs": {
        "da-a": "Milk", "da-b": "Eggs", "da-c": "Cheddar Cheese", "da-d": "Mozzarella Cheese", "da-e": "Yogurt", "da-f": "Butter", "da-g": "Sour Cream", "da-h": "Cream Cheese"
    },
    "Meat & Seafood": {
        "ms-a": "Chicken Breast", "ms-b": "Ground Beef", "ms-c": "Bacon", "ms-d": "Sausage", "ms-e": "Salmon", "ms-f": "Shrimp", "ms-g": "Steak", "ms-h": "Pork Chops"
    },
    "Pantry & Dry Goods": {
        "pa-a": "Bread", "pa-b": "Pasta", "pa-c": "Rice", "pa-d": "Cereal", "pa-e": "Flour", "pa-f": "Sugar", "pa-g": "Olive Oil", "pa-h": "Canned Tomatoes", "pa-i": "Canned Beans", "pa-j": "Peanut Butter"
    },
    "Snacks": {
        "sn-a": "Chips", "sn-b": "Crackers", "sn-c": "Pretzels", "sn-d": "Popcorn", "sn-e": "Granola Bars", "sn-f": "Nuts", "sn-g": "Cookies"
    },
    "Frozen": {
        "fr-a": "Frozen Pizza", "fr-b": "Ice Cream", "fr-c": "Frozen Vegetables", "fr-d": "Frozen Fries", "fr-e": "Waffles"
    }
};

let groceryList = {};

// --- II. DOM ELEMENTS ---
const itemInput = document.getElementById('item-input');
const addItemBtn = document.getElementById('add-item-btn');
const listContainer = document.getElementById('list-container');
const emptyListMessage = document.getElementById('empty-list-message');
const totalCostContainer = document.getElementById('total-cost-container');
const totalCostDisplay = document.getElementById('total-cost-display');
const shareBtn = document.getElementById('share-btn');
const pdfBtn = document.getElementById('pdf-btn');
const clearBtn = document.getElementById('clear-btn');
const leftLegend = document.getElementById('left-legend');
const rightLegend = document.getElementById('right-legend');

// --- III. INITIALIZATION & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', initializeApp);

/**
 * Sets up the application: populates legends, adds event listeners, and loads data.
 */
function initializeApp() {
    setupLegends();
    if (!loadListFromURL()) {
        loadListFromStorage();
    }
    renderList();
    addItemBtn.addEventListener('click', handleManualAddItem);
    itemInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleManualAddItem();
    });
    listContainer.addEventListener('click', handleListInteraction);
    listContainer.addEventListener('input', handleItemDetailChange);
    [leftLegend, rightLegend].forEach(legend => {
        legend.addEventListener('click', handleLegendClick);
    });
    shareBtn.addEventListener('click', handleShare);
    pdfBtn.addEventListener('click', handlePdf);
    clearBtn.addEventListener('click', handleClear);
}

// --- IV. CORE LOGIC & HANDLERS ---

/**
 * Handles adding an item when the user types it in manually.
 */
function handleManualAddItem() {
    const itemNameRaw = itemInput.value.trim();
    if (!itemNameRaw) return;
    const itemName = itemNameRaw.charAt(0).toUpperCase() + itemNameRaw.slice(1).toLowerCase();
    let found = false;
    for (const category in GROCERY_DATA) {
        for (const code in GROCERY_DATA[category]) {
            if (GROCERY_DATA[category][code].toLowerCase() === itemName.toLowerCase()) {
                addItemToList(category, { id: code, name: GROCERY_DATA[category][code], checked: false, type: '', qty: 1, price: '' });
                found = true;
                break;
            }
        }
        if (found) break;
    }
    if (!found) {
        addItemToList("Custom", { id: `cu-${Date.now()}`, name: itemNameRaw, checked: false, type: '', qty: 1, price: '' });
    }
    itemInput.value = '';
    itemInput.focus();
    saveListToStorage();
    renderList();
}

/**
 * Handles adding an item when a user clicks a button in the legend.
 * @param {Event} e The click event.
 */
function handleLegendClick(e) {
    const button = e.target.closest('.legend-item-btn');
    if (!button) return;
    const { id, name, category } = button.dataset;
    addItemToList(category, { id, name, checked: false, type: '', qty: 1, price: '' });
    saveListToStorage();
    renderList();
}

/**
 * Handles checkbox clicks and delete button clicks with precise DOM updates.
 * @param {Event} e The click event.
 */
function handleListInteraction(e) {
    const target = e.target;
    const itemElement = target.closest('.grocery-item');
    if (!itemElement) return;

    const itemId = itemElement.dataset.id;
    const categoryName = itemElement.closest('.category-group').dataset.category;
    const itemIndex = groceryList[categoryName].findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    if (target.matches('.delete-btn, .delete-btn *')) {
        groceryList[categoryName].splice(itemIndex, 1);
        const categoryGroup = itemElement.closest('.category-group');
        itemElement.remove();
        if (categoryGroup.querySelectorAll('.grocery-item').length === 0) {
            categoryGroup.remove();
        }
        if (Object.values(groceryList).every(arr => arr.length === 0)) {
            renderList();
        }
    } else if (target.type === 'checkbox') {
        const item = groceryList[categoryName][itemIndex];
        item.checked = target.checked;
        const itemNameSpan = itemElement.querySelector('.item-name');
        itemNameSpan.classList.toggle('line-through', item.checked);
        itemNameSpan.classList.toggle('text-gray-500', item.checked);
        itemNameSpan.classList.toggle('text-gray-100', !item.checked);
    }
    
    saveListToStorage();
    updateTotalCost();
}

/**
 * Handles changes to the type, quantity, and price input fields.
 * @param {Event} e The input event.
 */
function handleItemDetailChange(e) {
    const target = e.target;
    if (!target.matches('.type-input, .qty-input, .price-input')) return;

    const itemElement = target.closest('.grocery-item');
    const itemId = itemElement.dataset.id;
    const category = itemElement.closest('.category-group').dataset.category;
    const item = groceryList[category].find(item => item.id === itemId);

    if (item) {
        if (target.classList.contains('type-input')) {
            item.type = target.value;
        } else if (target.classList.contains('qty-input')) {
            item.qty = parseInt(target.value, 10) || 1;
        } else if (target.classList.contains('price-input')) {
            item.price = target.value;
        }
        saveListToStorage();
        updateTotalCost();
    }
}

/**
 * Generates and downloads a PDF of the list with custom branding.
 */
function handlePdf() {
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF.API.autoTable === 'undefined') {
        alert("Error: PDF libraries could not be loaded. Please check your internet connection and script order.");
        return;
    }
    if (Object.keys(groceryList).length === 0) {
        alert("Your list is empty.");
        return;
    }
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const tableData = [];
        const head = [['Done', 'Item', 'Type', 'Qty', 'Price', 'Category']];
        const pageContent = function(data) {
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.setFont('helvetica', 'italic');
            doc.text("made with love at 124915.xyz", data.settings.margin.left, 15);
            doc.text("Paid by/with: ____________________", doc.internal.pageSize.getWidth() - data.settings.margin.right, 15, { align: 'right' });
            
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFont('helvetica', 'normal');
            doc.text("Renaissance Gruppe", data.settings.margin.left, pageHeight - 10);
            
            const today = new Date();
            const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            doc.text(dateStr, doc.internal.pageSize.getWidth() - data.settings.margin.right, pageHeight - 10, { align: 'right' });
        };

        const categoryOrder = getSortedCategoryKeys();
        categoryOrder.forEach(category => {
            groceryList[category].forEach(item => {
                const price = parseFloat(item.price);
                const formattedPrice = !isNaN(price) ? `$${(price * item.qty).toFixed(2)}` : '';
                tableData.push([item.checked ? '[X]' : '[ ]', item.name, item.type || '', item.qty, formattedPrice, category]);
            });
        });

        doc.autoTable({
            head: head,
            body: tableData,
            didDrawPage: pageContent,
            startY: 20,
            styles: { font: 'helvetica', cellPadding: 2 },
            headStyles: { fillColor: [75, 85, 99] },
            theme: 'grid'
        });
        
        const finalY = doc.lastAutoTable.finalY;
        const totalCost = calculateTotalCost();
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Estimated Total: $${totalCost.toFixed(2)}`, 14, finalY + 10);

        doc.save('grocery-list.pdf');
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        alert("An unexpected error occurred while generating the PDF.");
    }
}

/**
 * Clears the entire grocery list after confirmation.
 */
function handleClear() {
    if (Object.keys(groceryList).length > 0 && confirm("Are you sure you want to clear the entire list?")) {
        groceryList = {};
        saveListToStorage();
        renderList();
    }
}

/**
 * Generates and copies a shareable link with full item details.
 */
function handleShare() {
    if (Object.keys(groceryList).length === 0) {
        alert("Your list is empty. Add some items to share!");
        return;
    }
    const itemsToEncode = [];
    for (const category in groceryList) {
        groceryList[category].forEach(item => {
            const type = item.type || ' ';
            const price = item.price || '0';
            const checked = item.checked ? '1' : '0';
            const qty = item.qty || '1';
            const id = item.id.startsWith('cu-') ? item.name : item.id;
            itemsToEncode.push([id, type, qty, price, checked].join('|'));
        });
    }
    const encodedString = encodeURIComponent(itemsToEncode.join(';'));
    const shareUrl = `${window.location.origin}${window.location.pathname}?list=${encodedString}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Shareable link with all details copied to clipboard!');
    }, () => {
        alert('Failed to copy link.');
    });
}

/**
 * Adds an item to the state, preventing duplicates.
 * @param {string} category The item's category.
 * @param {object} item The item object.
 */
function addItemToList(category, item) {
    if (!groceryList[category]) {
        groceryList[category] = [];
    }
    const isDuplicate = groceryList[category].some(existing => existing.name.toLowerCase() === item.name.toLowerCase());
    if (!isDuplicate) {
        groceryList[category].push(item);
    } else {
        const itemElement = document.querySelector(`.grocery-item[data-id="${item.id}"]`);
        if (itemElement) {
            itemElement.classList.add('flash-animation');
            setTimeout(() => itemElement.classList.remove('flash-animation'), 500);
        }
    }
}

// --- V. UI & RENDERING ---

/**
 * Renders the entire grocery list UI from the state.
 */
function renderList() {
    listContainer.innerHTML = '';
    if (Object.keys(groceryList).length === 0 || Object.values(groceryList).every(arr => arr.length === 0)) {
        listContainer.appendChild(emptyListMessage);
        emptyListMessage.classList.remove('hidden');
        totalCostContainer.classList.add('hidden');
        return;
    }
    emptyListMessage.classList.add('hidden');
    const sortedCategories = getSortedCategoryKeys();
    sortedCategories.forEach(category => {
        if (groceryList[category] && groceryList[category].length > 0) {
            listContainer.appendChild(createCategoryElement(category, groceryList[category]));
        }
    });
    updateTotalCost();
}

/**
 * Creates the HTML for a single category group and its items.
 * @param {string} categoryName The name of the category.
 * @param {Array<object>} items The items in the category.
 * @returns {HTMLElement} The category group element.
 */
function createCategoryElement(categoryName, items) {
    const group = document.createElement('div');
    group.className = 'category-group';
    group.dataset.category = categoryName;
    const heading = document.createElement('h2');
    heading.className = 'text-xl font-bold text-white border-b border-gray-700 pb-2 mb-3';
    heading.textContent = categoryName;
    group.appendChild(heading);
    const ul = document.createElement('ul');
    ul.className = 'space-y-2';
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'grocery-item bg-gray-900 p-3 rounded-lg space-y-2';
        li.dataset.id = item.id;
        
        const topRow = document.createElement('div');
        topRow.className = 'flex items-center justify-between';
        
        const checkboxLabel = document.createElement('label');
        checkboxLabel.className = 'flex items-center cursor-pointer';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox-custom';
        checkbox.checked = item.checked;
        
        const itemNameSpan = document.createElement('span');
        itemNameSpan.className = `ml-3 text-lg item-name ${item.checked ? 'line-through text-gray-500' : 'text-gray-100'}`;
        itemNameSpan.textContent = item.name;
        
        checkboxLabel.append(checkbox, itemNameSpan);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn text-gray-500 hover:text-red-500 transition-colors flex-shrink-0';
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        
        topRow.append(checkboxLabel, deleteBtn);
        
        const bottomRow = document.createElement('div');
        bottomRow.className = 'flex items-center space-x-2 pl-8';
        
        const typeInput = document.createElement('input');
        typeInput.type = 'text';
        typeInput.placeholder = 'Type';
        typeInput.className = 'detail-input type-input';
        typeInput.value = item.type || '';
        
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.placeholder = 'Qty';
        qtyInput.className = 'detail-input qty-input w-16 text-center';
        qtyInput.value = item.qty || 1;
        qtyInput.min = '1';

        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.placeholder = 'Price';
        priceInput.className = 'detail-input price-input w-24';
        priceInput.value = item.price || '';
        priceInput.step = '0.01';
        priceInput.min = '0';
        
        bottomRow.append(typeInput, qtyInput, priceInput);
        li.append(topRow, bottomRow);
        ul.appendChild(li);
    });
    group.appendChild(ul);
    return group;
}

/**
 * Calculates and updates the total estimated cost display.
 */
function updateTotalCost() {
    const total = calculateTotalCost();
    if (total > 0 || Object.keys(groceryList).length > 0) { // Show if total is > 0 OR if there are items
        totalCostContainer.classList.remove('hidden');
        totalCostDisplay.textContent = `$${total.toFixed(2)}`;
    } else {
        totalCostContainer.classList.add('hidden');
    }
}

/**
 * Calculates the total cost of all items in the list.
 * @returns {number} The total cost.
 */
function calculateTotalCost() {
    let total = 0;
    for (const category in groceryList) {
        groceryList[category].forEach(item => {
            const price = parseFloat(item.price);
            const qty = parseInt(item.qty, 10) || 1;
            if (!isNaN(price)) {
                total += price * qty;
            }
        });
    }
    return total;
}

// --- VI. LOCAL STORAGE, URL HANDLING, & OTHER HELPERS ---

/**
 * Saves the current list to localStorage.
 */
function saveListToStorage() {
    localStorage.setItem('smartGroceryList', JSON.stringify(groceryList));
}

/**
 * Loads the list from localStorage.
 */
function loadListFromStorage() {
    const savedList = localStorage.getItem('smartGroceryList');
    if (savedList) {
        groceryList = JSON.parse(savedList);
    }
}

/**
 * Loads the list from URL parameters.
 * @returns {boolean} True if list was loaded.
 */
function loadListFromURL() {
    const params = new URLSearchParams(window.location.search);
    const encodedList = params.get('list');
    if (!encodedList) return false;
    try {
        groceryList = {};
        const items = decodeURIComponent(encodedList).split(';');
        items.forEach(itemString => {
            const parts = itemString.split('|');
            if (parts.length < 5) return;
            const [idOrName, type, qty, price, checked] = parts;
            const itemData = {
                checked: checked === '1',
                type: type.trim() === '' ? '' : type,
                qty: parseInt(qty, 10) || 1,
                price: price === '0' ? '' : price,
            };
            let found = false;
            for (const category in GROCERY_DATA) {
                if (GROCERY_DATA[category][idOrName]) {
                    itemData.id = idOrName;
                    itemData.name = GROCERY_DATA[category][idOrName];
                    addItemToList(category, itemData);
                    found = true;
                    break;
                }
            }
            if (!found) {
                itemData.id = `cu-${Date.now()}-${idOrName}`;
                itemData.name = idOrName;
                addItemToList("Custom", itemData);
            }
        });
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
    } catch (error) {
        console.error("Failed to decode list from URL:", error);
        return false;
    }
}

/**
 * Populates the side legends with item buttons.
 */
function setupLegends() {
    const categories = Object.keys(GROCERY_DATA);
    const midPoint = Math.ceil(categories.length / 2);
    const leftCategories = categories.slice(0, midPoint);
    const rightCategories = categories.slice(midPoint);
    leftCategories.forEach(category => leftLegend.appendChild(createLegendCategory(category)));
    rightCategories.forEach(category => rightLegend.appendChild(createLegendCategory(category)));
}

/**
 * Creates a category box for the legend.
 * @param {string} categoryName The name of the category.
 * @returns {HTMLElement} The category element.
 */
function createLegendCategory(categoryName) {
    const container = document.createElement('div');
    container.className = 'bg-gray-800 rounded-lg p-4 border border-gray-700';
    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-white mb-3';
    title.textContent = categoryName;
    container.appendChild(title);
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex flex-wrap gap-2';
    const items = GROCERY_DATA[categoryName];
    for (const id in items) {
        const name = items[id];
        const button = document.createElement('button');
        button.className = 'legend-item-btn';
        button.textContent = name;
        button.dataset.id = id;
        button.dataset.name = name;
        button.dataset.category = categoryName;
        buttonContainer.appendChild(button);
    }
    container.appendChild(buttonContainer);
    return container;
}

/**
 * Gets a sorted array of category keys for consistent rendering.
 * @returns {Array<string>} The sorted keys.
 */
function getSortedCategoryKeys() {
    const predefinedOrder = Object.keys(GROCERY_DATA);
    const currentKeys = Object.keys(groceryList);
    const sortedKeys = predefinedOrder.filter(key => currentKeys.includes(key));
    if (currentKeys.includes("Custom")) {
        sortedKeys.push("Custom");
    }
    return sortedKeys;
}