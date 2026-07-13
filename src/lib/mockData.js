export const business = {
  name: "Ama Styles Boutique",
  owner: "Ama Serwaa",
  phone: "+233 24 456 7801",
  email: "sales@amastyles.com",
  location: "Adum, Kumasi",
  logoText: "AS",
};

export const products = [
  {
    id: 1,
    name: "Ankara Wrap Dress",
    category: "Dresses",
    costPrice: 180,
    sellingPrice: 280,
    quantity: 18,
    lowStockLimit: 6,
    supplier: "Makola Textiles",
    size: "M",
    colour: "Gold / Green",
    brand: "Ama Styles",
    itemType: "Dress",
    soldToday: 5,
  },
  {
    id: 2,
    name: "Kente Two-Piece",
    category: "Sets",
    costPrice: 240,
    sellingPrice: 390,
    quantity: 5,
    lowStockLimit: 6,
    supplier: "Bonwire Co-op",
    size: "L",
    colour: "Royal Blue",
    brand: "Bonwire",
    itemType: "Two-piece",
    soldToday: 3,
  },
  {
    id: 3,
    name: "Plain Office Shirt",
    category: "Tops",
    costPrice: 65,
    sellingPrice: 120,
    quantity: 32,
    lowStockLimit: 10,
    supplier: "Tudu Wholesale",
    size: "S - XL",
    colour: "White",
    brand: "Urban Fit",
    itemType: "Shirt",
    soldToday: 8,
  },
  {
    id: 4,
    name: "Leather Sandals",
    category: "Footwear",
    costPrice: 90,
    sellingPrice: 160,
    quantity: 7,
    lowStockLimit: 8,
    supplier: "Kumasi Craft",
    size: "38 - 42",
    colour: "Brown",
    brand: "CraftLine",
    itemType: "Sandals",
    soldToday: 2,
  },
];

export const sales = [
  {
    id: "BT-1045",
    customer: "Efua Mensah",
    items: 2,
    payment: "MoMo",
    amount: 670,
    time: "10:42 AM",
  },
  {
    id: "BT-1044",
    customer: "Walk-in",
    items: 1,
    payment: "Cash",
    amount: 280,
    time: "9:31 AM",
  },
  {
    id: "BT-1043",
    customer: "Akosua Trendz",
    items: 5,
    payment: "Credit",
    amount: 1240,
    time: "Yesterday",
  },
];

export const expenses = [
  {
    id: 1,
    title: "Courier delivery",
    category: "Transport",
    amount: 95,
    method: "MoMo",
    date: "Today",
  },
  {
    id: 2,
    title: "Packaging bags",
    category: "Packaging",
    amount: 180,
    method: "Cash",
    date: "Today",
  },
  {
    id: 3,
    title: "Shop electricity",
    category: "Utilities",
    amount: 260,
    method: "Bank",
    date: "Jul 2",
  },
];

export const debtors = [
  { id: 1, name: "Akosua Trendz", amount: 1240, due: "Due in 3 days" },
  { id: 2, name: "Kwame Boakye", amount: 450, due: "Due today" },
  { id: 3, name: "Mabel Osei", amount: 220, due: "Overdue" },
];

export const reportSeries = [
  { day: "Mon", sales: 2200, expenses: 520 },
  { day: "Tue", sales: 3150, expenses: 840 },
  { day: "Wed", sales: 1800, expenses: 410 },
  { day: "Thu", sales: 4280, expenses: 720 },
  { day: "Fri", sales: 3760, expenses: 640 },
  { day: "Sat", sales: 5120, expenses: 980 },
  { day: "Sun", sales: 1260, expenses: 220 },
];

export const expenseCategories = [
  "Rent",
  "Transport",
  "Utilities",
  "Staff wages",
  "Packaging",
  "Repairs",
  "Miscellaneous",
];
