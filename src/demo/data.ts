/**
 * Demo data generators — realistic datasets for the DataGrid demo pages.
 *
 * Three datasets:
 * 1. Simple — 5-row employee directory (existing)
 * 2. Wide — 50-column contact / appointment / location records (20 rows)
 * 3. Large — 5 000-row financial ledger with accounts & inventory
 */

import type { TableColumn } from '../components/table/types';
import type { ColumnFilterConfig } from '../components/filters/types';

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

/** Seeded pseudo-random for reproducible data */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randomDate(rand: () => number, startYear: number, endYear: number): string {
  const y = startYear + Math.floor(rand() * (endYear - startYear));
  const m = 1 + Math.floor(rand() * 12);
  const d = 1 + Math.floor(rand() * 28);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function randomDateTime(rand: () => number, startYear: number, endYear: number): string {
  const date = randomDate(rand, startYear, endYear);
  const h = Math.floor(rand() * 24);
  const min = Math.floor(rand() * 60);
  return `${date}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function randomPhone(rand: () => number): string {
  const area = 200 + Math.floor(rand() * 800);
  const ex = 200 + Math.floor(rand() * 800);
  const num = 1000 + Math.floor(rand() * 9000);
  return `(${area}) ${ex}-${num}`;
}

function randomZip(rand: () => number): string {
  return String(10000 + Math.floor(rand() * 90000));
}

function randomAmount(rand: () => number, min: number, max: number, decimals = 2): number {
  return Number((min + rand() * (max - min)).toFixed(decimals));
}

// ───────────────────────────────────────────────────────────
// 1. Simple dataset (8 rows)
//    One of each data type: string, count, currency, date,
//    boolean, enum/status, and parent reference (manager).
// ───────────────────────────────────────────────────────────

export const SIMPLE_DATA = [
  { empId: 1, name: 'Alice Johnson',  department: 'Engineering', hireDate: '2019-03-15', salary: 125000, projects: 7,  active: true,  manager: ''              },
  { empId: 2, name: 'Bob Smith',      department: 'Marketing',   hireDate: '2020-07-01', salary:  95000, projects: 4,  active: true,  manager: 'Alice Johnson'  },
  { empId: 3, name: 'Charlie Brown',  department: 'Engineering', hireDate: '2018-01-10', salary: 140000, projects: 12, active: false, manager: 'Alice Johnson'  },
  { empId: 4, name: 'Diana Prince',   department: 'Design',      hireDate: '2021-11-22', salary: 110000, projects: 5,  active: true,  manager: 'Alice Johnson'  },
  { empId: 5, name: 'Eve Torres',     department: 'Marketing',   hireDate: '2022-04-30', salary:  88000, projects: 3,  active: true,  manager: 'Bob Smith'      },
  { empId: 6, name: 'Frank Garcia',   department: 'Finance',     hireDate: '2017-09-05', salary: 132000, projects: 9,  active: true,  manager: ''               },
  { empId: 7, name: 'Grace Lee',      department: 'Engineering', hireDate: '2023-02-14', salary: 105000, projects: 2,  active: true,  manager: 'Charlie Brown'  },
  { empId: 8, name: 'Hank Wilson',    department: 'Finance',     hireDate: '2020-06-18', salary: 115000, projects: 6,  active: false, manager: 'Frank Garcia'   },
];

export const SIMPLE_COLUMNS: TableColumn[] = [
  { field: 'empId',      header: 'ID',         width:  60, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'name',       header: 'Name',       width: 160, sortable: true, resizable: true },
  { field: 'department', header: 'Department',  width: 130, sortable: true, resizable: true },
  { field: 'hireDate',   header: 'Hire Date',   width: 120, sortable: true, resizable: true, typeInfo: { type: 'date' } },
  { field: 'salary',     header: 'Salary',      width: 110, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'projects',   header: 'Projects',    width:  90, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'active',     header: 'Active',      width:  80, sortable: true, resizable: true, typeInfo: { type: 'boolean' } },
  { field: 'manager',    header: 'Manager',     width: 150, sortable: true, resizable: true },
];

export const SIMPLE_FILTERS: ColumnFilterConfig[] = [
  { field: 'name',       displayName: 'Name',       filterType: 'string',  widget: 'textbox',  visible: true },
  { field: 'department', displayName: 'Department',  filterType: 'string',  widget: 'dropdown', options: ['Engineering', 'Marketing', 'Design', 'Finance'], visible: true },
  { field: 'hireDate',   displayName: 'Hire Date',   filterType: 'date',    visible: true },
  { field: 'salary',     displayName: 'Salary',      filterType: 'number',  visible: true },
  { field: 'projects',   displayName: 'Projects',    filterType: 'number',  visible: true },
  { field: 'active',     displayName: 'Active',      filterType: 'boolean', visible: true },
  { field: 'manager',    displayName: 'Manager',     filterType: 'string',  widget: 'textbox',  visible: true },
];

// ───────────────────────────────────────────────────────────
// 2. Wide dataset — 50 columns, 20 rows
//    Contact + Appointment + Location fields
// ───────────────────────────────────────────────────────────

const FIRST_NAMES = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const STREETS = ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine Rd', 'Elm St', 'Washington Blvd', 'Park Ave', 'Lake Dr', 'River Rd', 'Sunset Blvd', 'Highland Ave', 'Spring St', 'Forest Dr', 'Valley Rd'];
const CITIES = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin', 'Seattle', 'Denver', 'Boston', 'Nashville', 'Portland'];
const STATES = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'TX', 'WA', 'CO', 'MA', 'TN', 'OR'];
const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia'];
const COMPANIES = ['Acme Corp', 'Globex Inc', 'Initech', 'Umbrella Corp', 'Stark Industries', 'Wayne Enterprises', 'Oscorp', 'Cyberdyne Systems', 'Soylent Corp', 'Weyland-Yutani'];
const TITLES = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'];
const SUFFIXES = ['', '', '', 'Jr.', 'Sr.', 'III', 'PhD', 'MD'];
const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Legal', 'Operations', 'Product', 'Support', 'Research'];
const JOB_TITLES = ['Manager', 'Director', 'Analyst', 'Coordinator', 'Specialist', 'Associate', 'Vice President', 'Consultant', 'Lead', 'Administrator'];
const CATEGORIES = ['VIP', 'Regular', 'Prospect', 'Partner', 'Vendor', 'Internal'];
const APPT_TYPES = ['Meeting', 'Call', 'Review', 'Presentation', 'Interview', 'Training', 'Workshop', 'Consultation'];
const APPT_STATUSES = ['Confirmed', 'Tentative', 'Cancelled', 'Completed', 'Rescheduled'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];
const BUILDING_TYPES = ['Office', 'Warehouse', 'Retail', 'Mixed Use', 'Industrial', 'Medical', 'Educational'];
const FLOOR_MATERIALS = ['Carpet', 'Hardwood', 'Tile', 'Concrete', 'Laminate'];

export function generateWideData(count = 20): Record<string, unknown>[] {
  const rand = seededRandom(42);
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = pick(rand, FIRST_NAMES);
    const lastName = pick(rand, LAST_NAMES);
    const cityIdx = Math.floor(rand() * CITIES.length);

    rows.push({
      // ── Contact fields (1–25) ──
      contactId: 1000 + i,
      title: pick(rand, TITLES),
      firstName,
      middleName: rand() > 0.5 ? pick(rand, FIRST_NAMES)[0] + '.' : '',
      lastName,
      suffix: pick(rand, SUFFIXES),
      fullName: `${firstName} ${lastName}`,
      nickname: rand() > 0.7 ? firstName.substring(0, 3).toLowerCase() : '',
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${pick(rand, COMPANIES).toLowerCase().replace(/\s+/g, '')}.com`,
      emailSecondary: rand() > 0.6 ? `${firstName.toLowerCase()}@gmail.com` : '',
      phoneWork: randomPhone(rand),
      phoneCell: randomPhone(rand),
      phoneHome: rand() > 0.5 ? randomPhone(rand) : '',
      fax: rand() > 0.8 ? randomPhone(rand) : '',
      company: pick(rand, COMPANIES),
      department: pick(rand, DEPARTMENTS),
      jobTitle: `${pick(rand, DEPARTMENTS)} ${pick(rand, JOB_TITLES)}`,
      website: rand() > 0.4 ? `https://www.${lastName.toLowerCase()}.com` : '',
      linkedIn: `linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
      category: pick(rand, CATEGORIES),
      dateOfBirth: randomDate(rand, 1960, 2000),
      dateAdded: randomDate(rand, 2018, 2025),
      lastContacted: randomDate(rand, 2024, 2026),
      contactNotes: rand() > 0.5 ? `Follow up regarding ${pick(rand, DEPARTMENTS).toLowerCase()} project.` : '',
      isActive: rand() > 0.2,
      preferredContactMethod: pick(rand, ['Email', 'Phone', 'Text', 'Mail']),

      // ── Appointment fields (26–37) ──
      appointmentType: pick(rand, APPT_TYPES),
      appointmentDate: randomDateTime(rand, 2025, 2027),
      appointmentEnd: randomDateTime(rand, 2025, 2027),
      duration: pick(rand, [15, 30, 45, 60, 90, 120]),
      appointmentStatus: pick(rand, APPT_STATUSES),
      organizer: `${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`,
      attendeeCount: 1 + Math.floor(rand() * 15),
      priority: pick(rand, PRIORITIES),
      isRecurring: rand() > 0.7,
      recurrencePattern: rand() > 0.7 ? pick(rand, ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly']) : '',
      meetingRoom: `Room ${100 + Math.floor(rand() * 50)}`,
      appointmentNotes: rand() > 0.4 ? `Discuss ${pick(rand, ['budget', 'timeline', 'roadmap', 'staffing', 'deliverables'])}.` : '',

      // ── Location fields (38–50) ──
      streetAddress: `${100 + Math.floor(rand() * 9900)} ${pick(rand, STREETS)}`,
      suite: rand() > 0.5 ? `Suite ${100 + Math.floor(rand() * 900)}` : '',
      city: CITIES[cityIdx],
      state: STATES[cityIdx],
      zipCode: randomZip(rand),
      country: pick(rand, COUNTRIES),
      latitude: Number((25 + rand() * 23).toFixed(6)),
      longitude: Number((-125 + rand() * 55).toFixed(6)),
      timezone: pick(rand, TIMEZONES),
      buildingType: pick(rand, BUILDING_TYPES),
      squareFootage: Math.floor(500 + rand() * 49500),
      floorCount: 1 + Math.floor(rand() * 30),
      floorType: pick(rand, FLOOR_MATERIALS),
    });
  }

  return rows;
}

export const WIDE_COLUMNS: TableColumn[] = [
  // Contact
  { field: 'contactId', header: 'ID', width: 60, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'title', header: 'Title', width: 50, sortable: true, resizable: true },
  { field: 'firstName', header: 'First Name', width: 100, sortable: true, resizable: true },
  { field: 'middleName', header: 'M.I.', width: 45, sortable: true, resizable: true },
  { field: 'lastName', header: 'Last Name', width: 110, sortable: true, resizable: true },
  { field: 'suffix', header: 'Suffix', width: 55, sortable: true, resizable: true },
  { field: 'fullName', header: 'Full Name', width: 150, sortable: true, resizable: true },
  { field: 'nickname', header: 'Nickname', width: 80, sortable: true, resizable: true },
  { field: 'email', header: 'Email', width: 220, sortable: true, resizable: true },
  { field: 'emailSecondary', header: 'Email (2nd)', width: 180, sortable: true, resizable: true },
  { field: 'phoneWork', header: 'Work Phone', width: 130, sortable: true, resizable: true },
  { field: 'phoneCell', header: 'Cell Phone', width: 130, sortable: true, resizable: true },
  { field: 'phoneHome', header: 'Home Phone', width: 130, sortable: true, resizable: true },
  { field: 'fax', header: 'Fax', width: 130, sortable: true, resizable: true },
  { field: 'company', header: 'Company', width: 140, sortable: true, resizable: true },
  { field: 'department', header: 'Department', width: 110, sortable: true, resizable: true },
  { field: 'jobTitle', header: 'Job Title', width: 160, sortable: true, resizable: true },
  { field: 'website', header: 'Website', width: 180, sortable: true, resizable: true },
  { field: 'linkedIn', header: 'LinkedIn', width: 200, sortable: true, resizable: true },
  { field: 'category', header: 'Category', width: 90, sortable: true, resizable: true },
  { field: 'dateOfBirth', header: 'Date of Birth', width: 110, sortable: true, resizable: true },
  { field: 'dateAdded', header: 'Date Added', width: 110, sortable: true, resizable: true },
  { field: 'lastContacted', header: 'Last Contacted', width: 120, sortable: true, resizable: true },
  { field: 'contactNotes', header: 'Contact Notes', width: 250, sortable: false, resizable: true },
  { field: 'isActive', header: 'Active', width: 65, sortable: true, resizable: true },
  { field: 'preferredContactMethod', header: 'Preferred Contact', width: 130, sortable: true, resizable: true },
  // Appointment
  { field: 'appointmentType', header: 'Appt Type', width: 110, sortable: true, resizable: true },
  { field: 'appointmentDate', header: 'Appt Start', width: 150, sortable: true, resizable: true },
  { field: 'appointmentEnd', header: 'Appt End', width: 150, sortable: true, resizable: true },
  { field: 'duration', header: 'Duration (min)', width: 105, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'appointmentStatus', header: 'Appt Status', width: 110, sortable: true, resizable: true },
  { field: 'organizer', header: 'Organizer', width: 140, sortable: true, resizable: true },
  { field: 'attendeeCount', header: 'Attendees', width: 85, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'priority', header: 'Priority', width: 80, sortable: true, resizable: true },
  { field: 'isRecurring', header: 'Recurring', width: 80, sortable: true, resizable: true },
  { field: 'recurrencePattern', header: 'Recurrence', width: 100, sortable: true, resizable: true },
  { field: 'meetingRoom', header: 'Meeting Room', width: 110, sortable: true, resizable: true },
  { field: 'appointmentNotes', header: 'Appt Notes', width: 220, sortable: false, resizable: true },
  // Location
  { field: 'streetAddress', header: 'Street Address', width: 180, sortable: true, resizable: true },
  { field: 'suite', header: 'Suite', width: 90, sortable: true, resizable: true },
  { field: 'city', header: 'City', width: 110, sortable: true, resizable: true },
  { field: 'state', header: 'State', width: 55, sortable: true, resizable: true },
  { field: 'zipCode', header: 'Zip', width: 65, sortable: true, resizable: true },
  { field: 'country', header: 'Country', width: 120, sortable: true, resizable: true },
  { field: 'latitude', header: 'Latitude', width: 90, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'longitude', header: 'Longitude', width: 95, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'timezone', header: 'Timezone', width: 150, sortable: true, resizable: true },
  { field: 'buildingType', header: 'Building Type', width: 110, sortable: true, resizable: true },
  { field: 'squareFootage', header: 'Sq Ft', width: 80, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'floorCount', header: 'Floors', width: 60, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'floorType', header: 'Floor Type', width: 90, sortable: true, resizable: true },
];

export const WIDE_FILTERS: ColumnFilterConfig[] = [
  { field: 'firstName', displayName: 'First Name', filterType: 'string', widget: 'textbox', visible: true },
  { field: 'lastName', displayName: 'Last Name', filterType: 'string', widget: 'textbox', visible: true },
  { field: 'company', displayName: 'Company', filterType: 'string', widget: 'dropdown', options: COMPANIES, visible: true },
  { field: 'department', displayName: 'Department', filterType: 'string', widget: 'dropdown', options: DEPARTMENTS, visible: true },
  { field: 'category', displayName: 'Category', filterType: 'string', widget: 'dropdown', options: CATEGORIES, visible: true },
  { field: 'city', displayName: 'City', filterType: 'string', widget: 'dropdown', options: CITIES, visible: true },
  { field: 'state', displayName: 'State', filterType: 'string', widget: 'dropdown', options: [...new Set(STATES)], visible: true },
  { field: 'appointmentStatus', displayName: 'Appt Status', filterType: 'string', widget: 'dropdown', options: APPT_STATUSES, visible: true },
  { field: 'priority', displayName: 'Priority', filterType: 'string', widget: 'dropdown', options: PRIORITIES, visible: true },
];

// ───────────────────────────────────────────────────────────
// 3. Large dataset — 5 000 rows, ledger + inventory
// ───────────────────────────────────────────────────────────

const ACCOUNT_NAMES = [
  'Cash', 'Accounts Receivable', 'Accounts Payable', 'Sales Revenue',
  'Cost of Goods Sold', 'Office Supplies', 'Rent Expense', 'Utilities Expense',
  'Payroll Expense', 'Insurance Expense', 'Depreciation', 'Interest Income',
  'Interest Expense', 'Tax Expense', 'Advertising', 'Travel & Entertainment',
  'Equipment', 'Inventory Asset', 'Prepaid Expenses', 'Accrued Liabilities',
  'Unearned Revenue', 'Capital Stock', 'Retained Earnings', 'Consulting Revenue',
  'Repairs & Maintenance', 'Legal Fees', 'Bank Charges', 'Shipping & Freight',
  'Returns & Allowances', 'Bad Debt Expense',
];

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
const COST_CENTERS = ['HQ', 'West Region', 'East Region', 'Central', 'International', 'Online', 'R&D Lab'];
const VENDORS = ['ABC Supply Co', 'QuickParts Inc', 'Global Materials', 'TechSource', 'Office Depot', 'Sysco Corp', 'Grainger', 'Fastenal', 'HD Supply', 'Uline'];
const CUSTOMERS = ['Acme Corp', 'Globex Inc', 'Initech', 'Pied Piper', 'Hooli', 'Prestige Worldwide', 'Sterling Cooper', 'Dunder Mifflin', 'Vandelay Industries', 'Wonka Industries'];
const PAYMENT_METHODS = ['Wire Transfer', 'ACH', 'Check', 'Credit Card', 'Cash', 'PayPal'];
const TXN_STATUSES = ['Posted', 'Pending', 'Reconciled', 'Void'];
const TXN_TYPES = ['Invoice', 'Payment', 'Journal Entry', 'Credit Memo', 'Debit Memo', 'Transfer', 'Adjustment'];

const INVENTORY_ITEMS = [
  'Widget A-100', 'Widget B-200', 'Gadget Pro', 'Gadget Lite', 'Bolt M6x20',
  'Bolt M8x30', 'Nut M6', 'Nut M8', 'Washer Flat M6', 'Washer Lock M8',
  'Bearing 6204', 'Bearing 6205', 'O-Ring #12', 'O-Ring #16', 'Seal Kit A',
  'Motor 1HP', 'Motor 2HP', 'Pump Assembly', 'Filter Cartridge', 'Valve Gate 2"',
  'Pipe PVC 1"', 'Pipe PVC 2"', 'Cable Cat6 1000ft', 'Switch 24-port', 'Router Enterprise',
  'Laptop Stand', 'Monitor Arm', 'Keyboard Wireless', 'Mouse Ergonomic', 'Headset BT',
  'Paper A4 Ream', 'Toner Black', 'Toner Color', 'Stapler Heavy', 'Binder 3-Ring',
  'Desk Lamp LED', 'Chair Ergonomic', 'Desk Standing', 'Whiteboard 4x6', 'Projector HD',
];

const ITEM_CATEGORIES = ['Hardware', 'Fasteners', 'Mechanical', 'Electrical', 'Plumbing', 'IT Equipment', 'Office Supplies', 'Furniture'];
const WAREHOUSES = ['Warehouse A', 'Warehouse B', 'Distribution Center', 'Retail Store #1', 'Retail Store #2'];
const UNITS = ['each', 'box', 'case', 'ft', 'kg', 'lb', 'ream', 'set'];

export function generateLedgerData(count = 5000): Record<string, unknown>[] {
  const rand = seededRandom(123);
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const isDebit = rand() > 0.5;
    const amount = randomAmount(rand, 1, 50000);
    const item = pick(rand, INVENTORY_ITEMS);
    const unitCost = randomAmount(rand, 0.5, 500);
    const qty = 1 + Math.floor(rand() * 200);
    const txnDate = randomDate(rand, 2023, 2026);

    rows.push({
      // ── Ledger fields ──
      txnId: 100000 + i,
      txnDate,
      postDate: txnDate,
      period: `${txnDate.substring(0, 7)}`,
      fiscalYear: Number(txnDate.substring(0, 4)),
      txnType: pick(rand, TXN_TYPES),
      reference: `REF-${String(100000 + Math.floor(rand() * 900000))}`,
      account: pick(rand, ACCOUNT_NAMES),
      accountType: pick(rand, ACCOUNT_TYPES),
      costCenter: pick(rand, COST_CENTERS),
      debit: isDebit ? amount : 0,
      credit: isDebit ? 0 : amount,
      amount: isDebit ? amount : -amount,
      balance: randomAmount(rand, -100000, 500000),
      currency: pick(rand, ['USD', 'EUR', 'GBP', 'CAD']),
      exchangeRate: pick(rand, ['USD', 'EUR', 'GBP', 'CAD']) === 'USD' ? 1 : randomAmount(rand, 0.7, 1.5, 4),
      vendor: rand() > 0.4 ? pick(rand, VENDORS) : '',
      customer: rand() > 0.5 ? pick(rand, CUSTOMERS) : '',
      paymentMethod: pick(rand, PAYMENT_METHODS),
      status: pick(rand, TXN_STATUSES),
      approvedBy: rand() > 0.3 ? `${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}` : '',
      memo: rand() > 0.5 ? `${pick(rand, TXN_TYPES)} for ${pick(rand, ACCOUNT_NAMES).toLowerCase()}` : '',

      // ── Inventory fields ──
      itemCode: `SKU-${String(1000 + Math.floor(rand() * 9000))}`,
      itemName: item,
      itemCategory: pick(rand, ITEM_CATEGORIES),
      unitCost,
      quantity: qty,
      lineTotal: Number((unitCost * qty).toFixed(2)),
      unit: pick(rand, UNITS),
      warehouse: pick(rand, WAREHOUSES),
      binLocation: `${String.fromCharCode(65 + Math.floor(rand() * 8))}-${1 + Math.floor(rand() * 50)}`,
      reorderPoint: 5 + Math.floor(rand() * 50),
      qtyOnHand: Math.floor(rand() * 1000),
    });
  }

  return rows;
}

export const LEDGER_COLUMNS: TableColumn[] = [
  { field: 'txnId', header: 'Txn ID', width: 80, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'txnDate', header: 'Txn Date', width: 100, sortable: true, resizable: true },
  { field: 'postDate', header: 'Post Date', width: 100, sortable: true, resizable: true },
  { field: 'period', header: 'Period', width: 80, sortable: true, resizable: true },
  { field: 'fiscalYear', header: 'FY', width: 50, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'txnType', header: 'Type', width: 110, sortable: true, resizable: true },
  { field: 'reference', header: 'Reference', width: 120, sortable: true, resizable: true },
  { field: 'account', header: 'Account', width: 150, sortable: true, resizable: true },
  { field: 'accountType', header: 'Acct Type', width: 90, sortable: true, resizable: true },
  { field: 'costCenter', header: 'Cost Center', width: 110, sortable: true, resizable: true },
  { field: 'debit', header: 'Debit', width: 100, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
  { field: 'credit', header: 'Credit', width: 100, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
  { field: 'amount', header: 'Amount', width: 100, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
  { field: 'balance', header: 'Balance', width: 110, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
  { field: 'currency', header: 'Curr', width: 55, sortable: true, resizable: true },
  { field: 'exchangeRate', header: 'Exch Rate', width: 85, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'vendor', header: 'Vendor', width: 130, sortable: true, resizable: true },
  { field: 'customer', header: 'Customer', width: 140, sortable: true, resizable: true },
  { field: 'paymentMethod', header: 'Payment Method', width: 120, sortable: true, resizable: true },
  { field: 'status', header: 'Status', width: 90, sortable: true, resizable: true },
  { field: 'approvedBy', header: 'Approved By', width: 130, sortable: true, resizable: true },
  { field: 'memo', header: 'Memo', width: 220, sortable: false, resizable: true },
  { field: 'itemCode', header: 'Item Code', width: 90, sortable: true, resizable: true },
  { field: 'itemName', header: 'Item Name', width: 150, sortable: true, resizable: true },
  { field: 'itemCategory', header: 'Item Category', width: 110, sortable: true, resizable: true },
  { field: 'unitCost', header: 'Unit Cost', width: 85, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
  { field: 'quantity', header: 'Qty', width: 55, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'lineTotal', header: 'Line Total', width: 100, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
  { field: 'unit', header: 'Unit', width: 55, sortable: true, resizable: true },
  { field: 'warehouse', header: 'Warehouse', width: 130, sortable: true, resizable: true },
  { field: 'binLocation', header: 'Bin', width: 55, sortable: true, resizable: true },
  { field: 'reorderPoint', header: 'Reorder Pt', width: 85, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'qtyOnHand', header: 'On Hand', width: 75, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
];

export const LEDGER_FILTERS: ColumnFilterConfig[] = [
  { field: 'txnDate', displayName: 'Txn Date', filterType: 'date', visible: true },
  { field: 'txnType', displayName: 'Type', filterType: 'string', widget: 'dropdown', options: TXN_TYPES, visible: true },
  { field: 'account', displayName: 'Account', filterType: 'string', widget: 'dropdown', options: ACCOUNT_NAMES, visible: true },
  { field: 'accountType', displayName: 'Acct Type', filterType: 'string', widget: 'dropdown', options: ACCOUNT_TYPES, visible: true },
  { field: 'costCenter', displayName: 'Cost Center', filterType: 'string', widget: 'dropdown', options: COST_CENTERS, visible: true },
  { field: 'status', displayName: 'Status', filterType: 'string', widget: 'dropdown', options: TXN_STATUSES, visible: true },
  { field: 'vendor', displayName: 'Vendor', filterType: 'string', widget: 'textbox', visible: true },
  { field: 'customer', displayName: 'Customer', filterType: 'string', widget: 'textbox', visible: true },
  { field: 'itemCategory', displayName: 'Item Category', filterType: 'string', widget: 'dropdown', options: ITEM_CATEGORIES, visible: true },
  { field: 'warehouse', displayName: 'Warehouse', filterType: 'string', widget: 'dropdown', options: WAREHOUSES, visible: true },
];
