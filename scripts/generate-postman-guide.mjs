import { readFileSync, writeFileSync } from 'node:fs';

// Curated against the mounted routes, validators, controllers and services.
// These are illustrative expectations, not captured live responses.
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const json = x => JSON.stringify(x, null, 2);
const block = x => '```json\n' + json(x) + '\n```';
const v = n => `{{${n}}}`;
const endpoints = [];
const page = items => ({ items, pagination: { page: 1, pageSize: 20, total: items.length, totalPages: items.length ? 1 : 0 } });
const user = (role = 'SELLER') => ({ id: v(role === 'MANAGER' ? 'managerId' : 'sellerId'), name: role === 'MANAGER' ? 'QA Manager' : 'QA Seller', email: role === 'MANAGER' ? 'qa.manager@example.com' : 'qa.seller@example.com', phone: role === 'MANAGER' ? '+919000000101' : '+919000000102', role, active: true, managerId: role === 'MANAGER' ? null : v('managerId'), permissions: role === 'MANAGER' ? ['SELLER_READ', 'SELLER_CREATE'] : [], state: 'Maharashtra', district: 'Thane', village: 'Diva' });
const category = { id: v('categoryId'), name: 'QA Retail', active: true };
const customer = { id: v('customerId'), shopName: 'QA General Store', contactName: 'QA Customer', phone: '+919000000103', categoryId: v('categoryId'), sellerId: v('sellerId'), state: 'Maharashtra', district: 'Thane', village: 'Diva', active: true };
const location = (type, balance) => ({ id: v(type === 'HQ' ? 'hqLocationId' : type === 'WAREHOUSE' ? 'warehouseId' : 'sellerLocationId'), type, name: type === 'HQ' ? 'Headquarters (HQ)' : type === 'WAREHOUSE' ? 'QA Warehouse' : 'QA Seller', sellerId: type === 'SELLER' ? v('sellerId') : null, balance });
const sale = { id: v('saleId'), sellerId: v('sellerId'), customerId: v('customerId'), quantity: 10, unitPricePaise: 2500, totalPaise: 25000, paymentMode: 'PENDING', status: 'CONFIRMED', incentiveRatePaise: 200, incentiveAmountPaise: 2000 };
const invoice = { id: v('invoiceId'), saleId: v('saleId'), number: '<generated invoice number>', pdfPath: '<generated path or null>', snapshot: { quantity: 10, unitPricePaise: 2500, totalPaise: 25000, paymentMode: 'PENDING' } };
const settings = { id: 1, minimumPricePaise: 2500, incentiveRatePaise: 200 };
const permissions = [...read('src/constants/permissions.ts').matchAll(/^  "([^"]+)"/gm)].map(m => m[1]);
const query = {
 users: 'Optional: page (1–100000, default 1), pageSize (1–100, default 20), search (max 100), active (true/false), managerId (UUID), state, district, village (max 100 each). Location filters are case-insensitive exact matches. Do not send sort.',
 customers: 'Optional: page, pageSize, search (max 100), categoryId, sellerId (UUIDs), active (true/false), state, district, village (1–100 characters). Seller requests always use the logged-in seller; Manager results are assignment and territory scoped.',
 sales: 'Optional: page, pageSize, status (PENDING_APPROVAL/CONFIRMED/REJECTED), paymentMode (CASH/BANK/PENDING), period (all/this_month/last_month), customerId, sellerId (UUIDs), search (max 100). Month boundaries use UTC. Seller requests ignore sellerId and use the authenticated seller.',
 transactions: 'Optional: page, pageSize, locationId (stock-location UUID), type (RECEIPT/TRANSFER/SALE). Seller requests ignore locationId and use their own stock location.',
 categories: 'Optional: search (max 50), active (true/false). No pagination.',
 invoices: 'Optional: page, pageSize, search (max 100; invoice number or shop name).',
 dashboard: 'Optional: state, district, village (1–100 characters), managerId, sellerId, categoryId (UUIDs). Some metrics remain global; see implementation notes.',
 salesReport: 'Optional: from, to (YYYY-MM-DD or ISO datetime with timezone), state, district, village, managerId, sellerId, paymentMode, status, groupBy (date/seller/manager/state/district/village), format (json/csv/xlsx; default json). Default status is CONFIRMED. Date-only to includes the end of that UTC day.',
 inventoryReport: 'Optional: from, to (YYYY-MM-DD or ISO datetime), locationId (UUID), type (HQ/WAREHOUSE/SELLER), format (json/csv/xlsx; default json). Dates filter movements, not historical stock balances; type filters locations only.',
};
function add(group, method, path, title, message, data, options = {}) {
 const role = path.startsWith('/admin/') ? 'admin' : path.startsWith('/manager/') ? 'manager' : path.startsWith('/seller/') ? 'seller' : path.startsWith('/categories') ? 'admin' : 'none';
 endpoints.push({group, method, path, title, role, status: method === 'POST' ? 201 : 200, response: {success:true, ...(message ? {message} : {}), data}, ...options});
}
add('01 Health', 'GET', '/health', 'Check HTTP health', 'API is running', {status:'ok', database:'configured'}, {notes:'Also returns 200 with database not_configured when no database/auth configuration exists. This does not prove database connectivity.'});
add('01 Health', 'GET', '/ready', 'Check database readiness', 'API is ready', {database:'connected'}, {notes:'503: Database is not configured OR Database is unavailable. Readiness does not verify migrations.'});
for (const role of ['admin','manager','seller']) {
 add('02 Login', 'POST', '/auth/login', `Login as ${role}`, 'Login successful', {token:'<JWT>',tokenType:'Bearer',expiresInSeconds:3600,user:role === 'admin' ? {...user(),id:'<admin UUID>',role:'SUPER_ADMIN',managerId:null} : user(role.toUpperCase())}, {status:200,body:{login:v(`${role}Login`),password:v(`${role}Password`)},required:'login, password',notes:'Use existing assigned email or international phone. Email is lowercased. Token expiry follows JWT_EXPIRES_IN (default 3600 seconds). Admin identity fields depend on your bootstrap account.',save:{[`${role}Token`]:'data.token'}});
}
add('02 Login','GET','/auth/me','Get current account','Current user',{user:user()},{role:'seller'});
const inputUser = role => ({ name:role === 'MANAGER' ? 'QA Manager' : 'QA Seller',phone:role === 'MANAGER'?'+919000000101':'+919000000102',email:role==='MANAGER'?'qa.manager@example.com':'qa.seller@example.com',password:v(role==='MANAGER'?'managerPassword':'sellerPassword'),state:'Maharashtra',district:'Thane',village:'Diva' });
for (const kind of ['managers','sellers']) {
 const manager = kind === 'managers', label = manager?'Manager':'Seller', id = manager?'managerId':'sellerId';
 const body = {...inputUser(manager?'MANAGER':'SELLER'),...(manager?{permissions:['SELLER_READ','SELLER_CREATE']}:{managerId:v('managerId')})};
 add('03 Accounts','POST',`/admin/${kind}`,`Create ${label}`,`${label} created`,{user:user(manager?'MANAGER':'SELLER')},{body,required:manager?'name, phone, password':'name, phone, password, managerId',notes:'Optional: email, state, district, village; Manager creation also accepts permissions (default []). Name/location 1–100 characters; phone international format; password 12+ characters and at most 72 UTF-8 bytes. District requires state; village requires district. Seller needs an active Manager and matching territory; omitted territory inherits Manager values. Creates a zero-balance seller stock location.',save:{[id]:'data.user.id'}});
 add('03 Accounts','GET',`/admin/${kind}`,`List ${kind}`,`${label}s retrieved`,page([user(manager?'MANAGER':'SELLER')]),{query:query.users});
 add('03 Accounts','GET',`/admin/${kind}/${v(id)}`,`Get ${label}`,`${label} retrieved`,{user:user(manager?'MANAGER':'SELLER')});
 add('03 Accounts','PATCH',`/admin/${kind}/${v(id)}`,`Update ${label}`,`${label} updated`,{user:{...user(manager?'MANAGER':'SELLER'),name:`QA ${label} Updated`}},{body:{name:`QA ${label} Updated`},required:'At least one permitted field',notes:'Allowed: name, phone, email, state, district, village, active (boolean). Do not send role, password, managerId or permissions here. Null is not accepted. Changing active revokes old tokens; test deactivation after all sales tests.'});
}
add('03 Accounts','GET','/admin/permissions','List permission names',null,{permissions});
for (const path of [`/admin/managers/${v('managerId')}/permissions`,`/admin/permissions/managers/${v('managerId')}/permissions`]) {
 add('03 Accounts','PATCH',path,'Replace Manager permissions','Manager permissions updated successfully',{manager:{id:v('managerId'),name:'QA Manager',email:'qa.manager@example.com',phone:'+919000000101',role:'MANAGER',permissions:['SELLER_READ','SELLER_CREATE'],updatedAt:'<ISO timestamp>'}},{body:{permissions:['SELLER_READ','SELLER_CREATE']},required:'permissions (array)',notes:'Replaces the entire list; [] removes all permissions. Values must come from GET /admin/permissions. At most 15 entries before deduplication. These two URLs are aliases.'});
}
add('04 Manager sellers','GET','/manager/sellers','List assigned sellers','Assigned Sellers retrieved',page([user()]),{query:query.users,notes:'Requires SELLER_READ. Assigned Manager territory applies.'});
add('04 Manager sellers','GET',`/manager/sellers/${v('sellerId')}`,'Get assigned seller','Assigned Seller retrieved',{user:user()},{notes:'Requires SELLER_READ. Out-of-scope seller returns 404.'});
add('04 Manager sellers','POST','/manager/sellers','Create seller as Manager','Seller created',{user:{...user(),id:'<new seller UUID>',name:'QA Second Seller',phone:'+919000000104',email:'qa.seller2@example.com'}},{body:{...inputUser('SELLER'),name:'QA Second Seller',phone:'+919000000104',email:'qa.seller2@example.com'},required:'name, phone, password',notes:'Requires SELLER_CREATE. Optional email and territory. Do not send managerId, role or permissions. Manager comes from token. Keep this second seller separate from sellerId used in the main flow.'});
for (const prefix of ['/admin/categories','/categories']) {
 add('05 Categories','POST',prefix,'Create category','Category created',{category},{body:{name:'QA Retail'},required:'name (trimmed string, 1–50 characters)',notes:'Both category prefixes reach the same records. Use a different unique name when testing the alias; an existing name returns 409. /categories currently allows any authenticated role for both reads and writes.',save:{categoryId:'data.category.id'}});
 add('05 Categories','GET',prefix,'List categories','Categories retrieved',{items:[category]},{query:query.categories});
 add('05 Categories','GET',`${prefix}/${v('categoryId')}`,'Get category','Category retrieved',{category});
 add('05 Categories','PATCH',`${prefix}/${v('categoryId')}`,'Update category','Category updated',{category},{body:{active:true},required:'At least one of name (1–50 characters), active (boolean)',notes:'Use active:false only after dependent customer creation tests.'});
}
const customerBody = {shopName:'QA General Store',contactName:'QA Customer',phone:'+919000000103',categoryId:v('categoryId'),state:'Maharashtra',district:'Thane',village:'Diva'};
for (const role of ['seller','manager','admin']) {
 const prefix = `/${role}/customers`;
 add('06 Customers','POST',prefix,`Create customer as ${role}`,'Customer created',{customer},{body:{...customerBody,...(role==='seller'?{}:{sellerId:v('sellerId')})},required:`shopName, contactName, phone, categoryId, state, district, village${role==='seller'?'':', sellerId'}`,notes:'Optional: email; photoPath, photoUrl or imageUrl (max 500; photoPath wins); latitude (-90 to 90); longitude (-180 to 180). Names and location strings 1–100 characters. Category must be active. Seller token sets ownership automatically; Manager can assign only an active seller under that Manager. No multipart upload is implemented.',save:{customerId:'data.customer.id'}});
 add('06 Customers','GET',prefix,`List customers as ${role}`,'Customers retrieved',page([customer]),{query:query.customers});
 add('06 Customers','GET',`${prefix}/${v('customerId')}`,`Get customer as ${role}`,'Customer retrieved',{customer});
 add('06 Customers','PATCH',`${prefix}/${v('customerId')}`,`Update customer as ${role}`,'Customer updated',{customer:{...customer,contactName:'QA Customer Updated'}},{body:{contactName:'QA Customer Updated'},required:'At least one permitted field',notes:'All create fields are optional on update; active (boolean) is also accepted. Seller cannot reassign ownership. Manager can reassign only to their own active seller. Do not deactivate the main customer until sales tests are complete.'});
}
add('07 Stock','GET','/admin/inventory','Get stock summary','Inventory summary retrieved',{totalStock:0,hqStock:0,warehouseStock:0,sellerStock:0,locations:[location('HQ',0),location('SELLER',0)]},{notes:'Example is before stock receipts. Save the HQ location id and the SELLER location id whose sellerId matches your test seller. A seller user ID is not a stock-location ID.'});
add('07 Stock','POST','/admin/inventory/warehouses','Create warehouse','Warehouse created',{warehouse:location('WAREHOUSE',0)},{body:{name:'QA Warehouse'},required:'name (1–100 characters)',save:{warehouseId:'data.warehouse.id'},notes:'Duplicate warehouse name (case-insensitive) returns 409.'});
add('07 Stock','GET','/admin/inventory/warehouses','List warehouses','Warehouses retrieved',{items:[location('WAREHOUSE',0)]});
add('07 Stock','POST','/admin/inventory/receipts','Receive 100 packets at HQ','Stock receipt added to HQ',{hq:location('HQ',100),movement:{id:'<movement UUID>',type:'RECEIPT',quantity:100,destinationId:v('hqLocationId'),sourceId:null}},{body:{quantity:100},required:'quantity (positive integer)',notes:'Adds to current HQ balance; example assumes starting balance 0. Save data.hq.id as hqLocationId. Repeating this request adds another receipt.',save:{hqLocationId:'data.hq.id'}});
add('07 Stock','POST','/admin/inventory/transfers','Transfer 50 packets to seller','Stock transfer completed',{source:location('HQ',50),destination:location('SELLER',50),movement:{id:'<movement UUID>',type:'TRANSFER',quantity:50,sourceId:v('hqLocationId'),destinationId:v('sellerLocationId')}},{status:200,body:{sourceId:v('hqLocationId'),destinationId:v('sellerLocationId'),quantity:50},required:'sourceId, destinationId (stock-location UUIDs), quantity (positive integer)',notes:'Example assumes HQ 100 and seller 0. Source and destination must differ. Any existing location types are accepted. To test warehouses separately use HQ to warehouse, then warehouse to seller, with sufficient balances.'});
add('07 Stock','GET','/admin/inventory/transactions','List all stock movements','Stock transactions retrieved',page([{type:'TRANSFER',quantity:50,sourceId:v('hqLocationId'),destinationId:v('sellerLocationId')}]),{query:query.transactions});
add('07 Stock','GET','/seller/inventory','Get own stock','Inventory retrieved',{locationId:v('sellerLocationId'),name:'QA Seller',assigned:50,sold:0,remaining:50},{notes:'Call before transfer to get locationId (initial counters 0). Example shown after the 50-packet transfer.',save:{sellerLocationId:'data.locationId'}});
add('07 Stock','GET','/seller/inventory/transactions','List own movements','Transactions retrieved',page([{type:'TRANSFER',quantity:50,destinationId:v('sellerLocationId')}]),{query:query.transactions});
add('07 Stock','GET','/manager/inventory','Get assigned sellers stock','Assigned inventory summary retrieved',{summary:{totalSellers:1,totalAssigned:50,totalSold:0,totalRemaining:50},sellers:[{seller:{id:v('sellerId'),name:'QA Seller',phone:'+919000000102',state:'Maharashtra',district:'Thane',village:'Diva'},assigned:50,sold:0,remaining:50}]},{notes:'Assignment plus Manager state/district scope. No query filters used. Counts include any additional sellers you created.'});
add('08 Settings','GET','/admin/incentives/settings','Read business settings','Business settings retrieved',{settings},{notes:'Initial incentiveRatePaise may be null. Default minimum price is 2500 paise.'});
add('08 Settings','PATCH','/admin/incentives/settings','Set price and incentive','Business settings updated',{settings},{body:{minimumPricePaise:2500,incentiveRatePaise:200},required:'At least one of minimumPricePaise (positive integer), incentiveRatePaise (nonnegative integer or null)',notes:'Sets minimum unit price to INR 25 and incentive to INR 2 per packet. Null disables the configured incentive rate for future confirmations. Existing confirmed sales retain their snapshots.'});
add('09 Sales','POST','/seller/sales','Create confirmed unpaid sale','Sale confirmed successfully',{sale:{...sale,invoice}},{body:{customerId:v('customerId'),quantity:10,unitPricePaise:2500,paymentMode:'PENDING'},required:'customerId (UUID), quantity (positive integer), unitPricePaise (positive integer), paymentMode (CASH/BANK/PENDING)',notes:'Optional requestKey (trimmed string, max 100). Customer must be active and assigned to seller. With minimum 2500 this confirms immediately, deducts 10 packets, creates invoice and snapshots incentive 2000. PENDING means unpaid, not awaiting approval. CASH/BANK additionally creates a full payment record. PDF creation failure can leave pdfPath null without failing sale.',save:{saleId:'data.sale.id',invoiceId:'data.sale.invoice.id'}});
add('09 Sales','POST','/seller/sales','Create low-price sale for approval','Sale recorded and sent for low-price approval',{sale:{...sale,id:v('pendingSaleId'),quantity:5,unitPricePaise:2000,totalPaise:10000,status:'PENDING_APPROVAL',incentiveRatePaise:null,incentiveAmountPaise:null}},{body:{customerId:v('customerId'),quantity:5,unitPricePaise:2000,paymentMode:'PENDING'},required:'customerId, quantity, unitPricePaise, paymentMode',notes:'Minimum must still be 2500. No stock is deducted, no invoice is created and no incentive is calculated until approval. Save a separate pendingSaleId; do not overwrite saleId.',save:{pendingSaleId:'data.sale.id'}});
for (const role of ['seller','manager','admin']) {
 add('09 Sales','GET',`/${role}/sales`,`List sales as ${role}`,role==='seller'?'Sales history retrieved':role==='manager'?'Assigned sales records retrieved':'Sales records retrieved',page([sale]),{query:query.sales});
 add('09 Sales','GET',`/${role}/sales/${v('saleId')}`,`Get sale as ${role}`,'Sale details retrieved',{sale:{...sale,invoice,payments:[]}},{notes:'Seller sees own sales. Manager sees assigned sellers’ sales. Invoice may be null for pending/rejected sales; payments is empty before collecting a PENDING payment.'});
}
add('09 Sales','PATCH',`/seller/sales/${v('saleId')}/payment`,'Collect full pending payment','Pending payment collected successfully',{sale:{...sale,paymentMode:'CASH'},payment:{id:'<payment UUID>',saleId:v('saleId'),collectorId:v('sellerId'),mode:'CASH',amountPaise:25000}},{body:{mode:'CASH'},required:'mode (CASH or BANK)',notes:'No amount field; collects full sale.totalPaise. Does not deduct stock again. Repeat returns 409. Use the confirmed unpaid sale from the main flow; the implementation currently does not check sale status here.'});
add('10 Approvals','GET','/admin/approvals','List pending approvals','Pending sale approval requests retrieved',page([{...sale,id:v('pendingSaleId'),quantity:5,unitPricePaise:2000,totalPaise:10000,status:'PENDING_APPROVAL',incentiveRatePaise:null,incentiveAmountPaise:null}]),{query:'Optional effective filters: page, pageSize, sellerId, customerId, search. The shared schema also accepts status, paymentMode and period, but this service ignores those three and always returns PENDING_APPROVAL.'});
add('10 Approvals','POST',`/admin/approvals/${v('pendingSaleId')}/approve`,'Approve low-price sale','Sale approved and confirmed successfully',{sale:{...sale,id:v('pendingSaleId'),quantity:5,unitPricePaise:2000,totalPaise:10000,incentiveAmountPaise:1000,invoice:{id:'<new invoice UUID>',saleId:v('pendingSaleId')}}},{status:200,notes:'No body. Requires sufficient seller stock. Deducts 5, creates invoice, snapshots the current incentive rate, records decision metadata. A second decision returns 409.'});
add('10 Approvals','POST',`/admin/approvals/${v('rejectSaleId')}/reject`,'Reject a separate low-price sale','Sale rejected',{sale:{...sale,id:v('rejectSaleId'),quantity:5,unitPricePaise:2000,totalPaise:10000,status:'REJECTED',incentiveRatePaise:null,incentiveAmountPaise:null,rejectionReason:'Price below approved minimum'}},{status:200,body:{reason:'Price below approved minimum'},required:'None; reason is optional (1–500 characters when supplied)',notes:'First create another low-price sale and save its id as rejectSaleId. Body {} or no body uses the default reason. Stock stays unchanged; no invoice or incentive is created.'});
add('11 Invoices','GET','/admin/invoices','List invoices','Invoices retrieved',page([invoice]),{query:query.invoices});
add('11 Invoices','GET',`/admin/invoices/${v('invoiceId')}`,'Get invoice','Invoice details retrieved',{invoice},{notes:'Returns JSON, not PDF bytes. Full response includes sale/customer/seller/payments. snapshot retains the original invoice data. pdfPath can be null; no invoice download route is mounted.'});
add('12 Incentives','GET','/seller/incentives','Get own incentives','Incentives retrieved',{summary:{totalPacketsSold:15,totalIncentivePaise:3000,totalIncentiveRupees:30},items:[{saleId:v('saleId'),date:'<ISO timestamp>',customer:{id:v('customerId'),shopName:'QA General Store',contactName:'QA Customer'},quantity:10,incentiveRatePaise:200,incentiveAmountPaise:2000},{saleId:v('pendingSaleId'),quantity:5,incentiveRatePaise:200,incentiveAmountPaise:1000}]},{notes:'Example after confirmed sale of 10 plus approved sale of 5; rejected sales excluded. No pagination or query filters.'});
add('12 Incentives','GET','/admin/incentives','Get all seller incentives','Incentive reports retrieved',{currentRatePaise:200,sellers:[{seller:{id:v('sellerId'),name:'QA Seller',phone:'+919000000102'},totalConfirmedPackets:15,totalIncentivePaise:3000,totalIncentiveRupees:30}]});
add('13 Dashboards','GET','/seller/dashboard','Get seller dashboard','Seller dashboard retrieved',{metrics:{assignedPackets:50,soldPackets:15,remainingPackets:35,totalIncentivePaise:3000,totalIncentiveRupees:30},recentSales:[sale]},{notes:'No query filters. recentSales contains up to five recent sales of any status.'});
add('13 Dashboards','GET','/manager/dashboard','Get Manager dashboard','Manager dashboard retrieved',{metrics:{totalSellers:1,totalCustomers:1,totalPacketsSold:15,totalEarningsPaise:35000,totalEarningsRupees:350,totalRemainingStock:35}},{notes:'No query filters. Example assumes one seller/customer in scope. Counts may increase if you exercise alternate create routes.'});
add('13 Dashboards','GET','/admin/dashboard','Get Admin dashboard','Super Admin dashboard retrieved',{metrics:{totalPacketsSold:15,totalEarningsPaise:35000,totalEarningsRupees:350,totalStates:1,totalShops:1,totalManagers:1,totalSellers:1,totalInventory:85,hqStock:50,warehouseStock:0,sellerStock:35,totalIncentivePaise:3000,totalIncentiveRupees:30},appliedFilters:{}},{query:query.dashboard});
add('13 Dashboards','GET','/admin/dashboard/filters','Get dashboard filters','Filter options retrieved',{categories:[{id:v('categoryId'),name:'QA Retail'}],states:['Maharashtra'],districts:['Thane']});
const profile = {...user(),createdAt:'<ISO timestamp>',updatedAt:'<ISO timestamp>',manager:{id:v('managerId'),name:'QA Manager',phone:'+919000000101',email:'qa.manager@example.com'},stockLocation:{id:v('sellerLocationId'),name:'QA Seller',balance:35}};
delete profile.managerId; delete profile.permissions;
add('14 Profile','GET','/seller/profile','Get seller profile',null,{profile});
add('14 Profile','PATCH','/seller/profile','Update own profile','Profile updated successfully',{profile:{...profile,name:'QA Seller Updated'}},{body:{name:'QA Seller Updated'},required:'At least one of name (1–100 characters), phone (international), email (valid email)',notes:'No role, active, managerId, location or password fields accepted. Duplicate phone/email returns 409. Updating phone/email changes the login identifier.'});
add('15 Reports','GET','/admin/reports/sales','Get sales report',null,{summary:{totalSalesCount:2,totalQuantitySold:15,grossSalesPaise:35000,grossSalesRupees:350,netSalesPaise:35000,netSalesRupees:350,averageOrderValueRupees:175},items:[sale]},{query:query.salesReport,notes:'Optional groups array appears only with groupBy. JSON items capped at 500; CSV/XLSX at 5000. Summary aggregates all matches; groups only cover returned rows. Example totals assume the main flow. Export with ?format=csv or ?format=xlsx; expect HTTP 200 and attachment sales-report.csv/.xlsx, not JSON.'});
add('15 Reports','GET','/admin/reports/inventory','Get inventory report',null,{summary:{totalStock:85,hqStock:50,warehouseStock:0,sellerStock:35,totalReceived:100,totalTransferred:50,totalSold:15},locations:[location('HQ',50),location('SELLER',35)],movements:[{type:'SALE',quantity:5}]},{query:query.inventoryReport,notes:'JSON movements capped at 500. CSV/XLSX exports location rows (not movement rows), with attachment inventory-report.csv/.xlsx. Expect text/csv or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.'});
add('16 Password tests last','PATCH','/auth/password','Change seller password','Password changed. Log in again',{}, {role:'seller',body:{currentPassword:v('sellerPassword'),newPassword:v('newPassword')},required:'currentPassword, newPassword',notes:'New password 12+ characters and at most 72 UTF-8 bytes. All prior seller tokens become invalid. Update sellerPassword and log in again after success.'});
add('16 Password tests last','POST','/auth/forgot-password','Request seller password reset',null,null,{status:200,body:{login:v('sellerLogin')},required:'login (1–254 characters)',response:{success:true,message:'If an account exists, a password reset request has been created.',debugToken:'<non-production active-account token only>'},notes:'Public. Existing active account in non-production receives debugToken at the top level. Save as resetToken. Unknown/inactive account and production responses omit debugToken. Tokens expire after 20 minutes; requesting again invalidates previous tokens. No email/SMS delivery is implemented.',save:{resetToken:'debugToken'}});
add('16 Password tests last','POST','/auth/reset-password','Reset seller password',null,null,{status:200,body:{token:v('resetToken'),newPassword:v('newPassword')},required:'token (1–256 characters), newPassword (12+ characters, max 72 UTF-8 bytes)',response:{success:true,message:'Password reset successfully. Please log in with your new password.'},notes:'Public. Update sellerPassword and log in again. Token is one-use; old JWTs are revoked. Invalid/expired/used token returns 400.'});

const intro = `# Femmeflo API manual testing guide for Postman

Prepared 8 October 2026. This guide covers the API operations mounted by the current source code. Expected responses are code-derived examples, not results of live requests. Existing API.md and openapi.json describe an older implementation and omit several current modules.

## How to use this guide

Use the setup and main test flow first, then use the endpoint reference for individual tests. Every reference entry specifies the method, URL, token, required body fields, optional query parameters and expected status/JSON. Response examples are **key-field projections**: actual JSON can include additional model fields, timestamps and nested relations. IDs, timestamps, invoice numbers and totals vary with your data. Array examples show representative rows rather than every row; pagination examples assume one matching record. Do not compare dynamic JSON literally.

### Start the API

From the server directory, install dependencies with npm.cmd ci if needed. Configure local .env using .env.example, with DATABASE_URL and JWT_SECRET. On a dedicated development database, run npm.cmd run db:migrate. If no Super Admin exists, configure ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD, then run npm.cmd run db:bootstrap-admin. Bootstrap refuses to replace an existing Admin. Start with npm.cmd run dev. Do not overwrite an existing .env. Default port is 5000; use your configured PORT if different.

Check GET /health and GET /ready before authentication. Without database/auth configuration, /auth/* returns 503 and protected business routes are not mounted (404). A configured but unreachable database can prevent startup. A successful readiness response does not prove migrations exist.

### Configure Postman

Import **postman-manual-testing.postman_collection.json** from this docs folder. It contains all operations below, role-specific Bearer tokens, sample bodies, expected response examples and status checks. Requests are intended to be sent individually; do not run the whole collection blindly because it includes alternative creation routes and password changes.

The collection contains these variables. Edit them in the collection Variables tab (or use an environment consistently; environment values override collection values). Credentials and tokens are local test values; enter the Admin credentials you bootstrapped.

| Variable | Value or source |
| --- | --- |
| baseUrl | http://localhost:5000/api/v1 (no trailing slash) |
| adminLogin / adminPassword | Your existing Super Admin credentials |
| managerLogin / managerPassword | qa.manager@example.com / Example password 123! |
| sellerLogin / sellerPassword | qa.seller@example.com / Example password 123! |
| newPassword | Replacement password 123! |
| adminToken / managerToken / sellerToken | data.token from the corresponding login |
| managerId / sellerId | data.user.id from account creation |
| categoryId / customerId | data.category.id / data.customer.id |
| hqLocationId | data.hq.id from receipt or HQ entry in inventory summary |
| sellerLocationId | data.locationId from GET /seller/inventory |
| warehouseId | data.warehouse.id (a stock-location ID) |
| saleId / pendingSaleId / rejectSaleId | Separate IDs for confirmed, approval and rejection cases |
| invoiceId | data.sale.invoice.id from confirmed sale |
| resetToken | Top-level debugToken from development forgot-password response |

Save returned IDs/tokens manually. The collection deliberately does not overwrite variables automatically. Unresolved {{variables}} are not valid UUIDs. Use unique emails, phones, category and warehouse names when repeating setup in an existing database.

For JSON writes choose Body → raw → JSON, with Content-Type: application/json. Protected calls use Authorization → Bearer Token with the role token shown. Public calls use No Auth. GET requests have no body; enter filters in Params. The collection already configures these settings.

### Shared rules

- Money fields ending in Paise are integers: 2500 = INR 25, 200 = INR 2. Quantities are packet counts, not currency.
- IDs are UUIDs returned by the API. Stock location IDs differ from user IDs.
- Phone example: +919000000101. New passwords need at least 12 characters and at most 72 UTF-8 bytes.
- Strict body/query schemas reject unknown keys. Most PATCH calls require at least one allowed field. Optional generally means omit, not null; incentiveRatePaise explicitly permits null.
- Paginated endpoints default to page=1 and pageSize=20, with maximum pageSize=100. An empty paginated result is items:[] and total=0, totalPages=0.
- Login, forgot-password, reset-password and password change share 20 requests per IP per 15 minutes. HTTP 429 includes Retry-After. Avoid repeatedly logging in for every request.
- There is no public signup, refresh token, logout, DELETE, file-upload or mounted invoice-PDF-download endpoint.

## Main test flow

This sequence makes the numeric expectations repeatable for a new seller. Existing global database data can change Admin totals; record starting balances and compare deltas when needed.

| Step | Request and action | Expected result |
| --- | --- | --- |
| 1 | GET /health then /ready | 200; database configured then connected |
| 2 | POST /auth/login as Admin; save adminToken | 200; user.role SUPER_ADMIN |
| 3 | POST /admin/managers; save managerId | 201; MANAGER with SELLER_READ and SELLER_CREATE |
| 4 | POST /admin/sellers using managerId; save sellerId | 201; SELLER and initial stock 0 |
| 5 | Login as Manager and Seller; save both tokens | 200; respective role |
| 6 | POST /admin/categories; save categoryId | 201; active category |
| 7 | POST /seller/customers; save customerId | 201; customer owned by test seller |
| 8 | GET /seller/inventory; save sellerLocationId | 200; assigned/sold/remaining all 0 |
| 9 | POST /admin/inventory/receipts with quantity 100; save hqLocationId | 201; HQ increases by 100 |
| 10 | POST /admin/inventory/transfers HQ → seller, quantity 50 | 200; seller 50; HQ decreases by 50 |
| 11 | PATCH /admin/incentives/settings with minimum 2500, incentive 200 | 200; settings saved |
| 12 | POST /seller/sales: 10 packets at 2500, PENDING payment; save saleId and invoiceId | 201 CONFIRMED; total 25000, incentive 2000; seller stock 40 |
| 13 | PATCH /seller/sales/{{saleId}}/payment with mode CASH | 200; payment 25000, stock still 40 |
| 14 | POST /seller/sales: 5 packets at 2000, PENDING; save pendingSaleId | 201 PENDING_APPROVAL; total 10000, stock still 40 |
| 15 | GET /admin/approvals, then POST /admin/approvals/{{pendingSaleId}}/approve | 200 CONFIRMED; incentive 1000; stock 35 |
| 16 | Create another 5-packet low-price sale; save rejectSaleId; POST reject | 200 REJECTED; stock stays 35; no invoice for rejected sale |
| 17 | Read sales, invoices, incentives, dashboards and reports | Two confirmed sales, 15 sold, 35000 paise sales, 3000 paise incentive; seller 35 remaining |
| 18 | Test alternate routes, warehouse transfers and filters separately | Compare changes against current balances; totals above will change |
| 19 | Perform password/reset and deactivation tests last | Old tokens rejected; login again with current credentials |

The unpaid approved sale still counts toward confirmed sales revenue and incentives. Payment collection is a separate operation. After the main flow on an otherwise empty database: HQ 50, seller 35, total stock 85; one CASH sale and one PENDING-payment confirmed sale.

## Endpoint reference

The collection repeats login for three roles and sale creation for two scenarios. Alias paths are documented separately. General error checks follow the endpoint reference.
`;
let md = intro;
let group;
for (const [i,e] of endpoints.entries()) {
 if (group !== e.group) {group=e.group;md+=`\n### ${group}\n`;}
 md += `\n#### ${String(i+1).padStart(2,'0')} ${e.title}\n\n**${e.method} {{baseUrl}}${e.path}**\n\nAuthorization: ${e.role==='none'?'No Auth':`Bearer {{${e.role}Token}}`}. Expected HTTP **${e.status}**.\n\n`;
 if (e.path.startsWith('/categories')) md += 'Access: any authenticated active account; adminToken is selected for the sample.\n\n';
 if (e.path==='/auth/me'||e.path==='/auth/password') md += 'Access: any authenticated active account; sellerToken is selected for the sample.\n\n';
 md += `Query parameters: ${e.query ?? 'None used by this handler.'}\n\n`;
 md += e.body ? `Required body fields: ${e.required}.\n\nRequest body:\n\n${block(e.body)}\n\n` : 'Request body: **none**.\n\n';
 if(e.notes) md+=e.notes+'\n\n';
 if(e.save) md+='Save from response: '+Object.entries(e.save).map(([key,path])=>`\`${path}\` → \`{{${key}}}\``).join('; ')+'.\n\n';
 md+=`Expected response (key fields):\n\n${block(e.response)}\n`;
}
md+=`\n## Negative tests and expected errors

All handled errors use JSON with success:false and message; they do not include a success data object. Validation text can vary with the field/Zod version, so check the status and offending field rather than exact full text unless an exact message is listed below.

| Test | Expected HTTP | Expected message or behavior |
| --- | --- | --- |
| Protected call without Authorization | 401 | Authentication required |
| Invalid, expired, or revoked JWT | 401 | Invalid or expired token |
| Seller token on /admin/inventory | 403 | Access denied |
| Manager without SELLER_READ on /manager/sellers | 403 | Permission denied |
| POST /auth/login with {} | 400 | Provide login and password |
| Login with wrong password or inactive account | 401 | Invalid credentials or inactive account |
| Malformed JSON | 400 | Request body must be valid JSON |
| Invalid UUID in a validated path/body | 400 | Validation message naming id or field |
| Create/update with unexpected body key | 400 | Validation error (strict schema) |
| Empty PATCH body for accounts/category/customer/profile/settings | 400 | At least one field/setting required |
| New password shorter than 12 characters | 400 | Password validation error |
| Invalid international phone | 400 | Use an international phone number, e.g. +919876543210 |
| User creation with already-used email/phone | 409 | A record with those unique details already exists |
| Recreate category with same case-insensitive name | 409 | Category with this name already exists |
| Recreate warehouse with same case-insensitive name | 409 | Warehouse with this name already exists |
| Seller creation with nonexistent/inactive Manager UUID | 404 | Active Manager not found |
| Seller territory conflicts with Manager | 403 | Seller territory must be within the assigned Manager's territory |
| Manager/Admin create customer without sellerId | 400 | sellerId is required when onboarding customer as Manager or Admin |
| Customer create with inactive/nonexistent category UUID | 400 | Invalid or inactive category ID |
| Manager assigns customer to another Manager's seller | 403 | Seller is not assigned to you |
| Seller reassigns own customer to another seller | 403 | Sellers cannot reassign customer ownership |
| Receipt, transfer or sale quantity 0, negative or fractional | 400 | Quantity validation error |
| Transfer sourceId equals destinationId | 400 | Source and destination cannot be the same location |
| Transfer with nonexistent stock-location UUID | 404 | Source or destination stock location not found |
| Transfer exceeds source balance | 409 | Insufficient stock at ... Available: ..., Requested: ... |
| Sale with inactive/nonexistent customer | 400 | Invalid or inactive customer ID |
| Sale for another seller's customer | 403 | Customer is not assigned to you |
| Confirmed-price sale exceeds seller balance | 409 | Insufficient stock balance. Available: ..., Requested: ... |
| Approve pending sale without enough stock | 409 | Insufficient stock at seller location. Available: ..., Requested: ... |
| Approve/reject already-decided sale | 409 | Sale has already been decided with status: CONFIRMED or REJECTED |
| Repeat payment collection | 409 | Payment for this sale has already been set to CASH or BANK |
| Payment mode PENDING in collect-payment body | 400 | Only CASH/BANK accepted |
| Seller reads another seller's sale | 404 | Sale record not found |
| Reset token invalid, expired or reused | 400 | Invalid, expired, or already used password reset token |
| Wrong current password on password change | 401 | Current password is incorrect |
| Authentication rate limit exceeded | 429 | Too many authentication attempts. Try again later |
| Unknown route | 404 | Route not found |
| JSON larger than 100 KB | 413 | Request body is too large |
| Unexpected server/database failure | 500 | Internal server error; this is a defect/setup failure, not a success |

Example exact error:

${block({success:false,message:'Source and destination cannot be the same location'})}

### Permission and scope checks

As Admin, replace the test Manager permissions with [] and confirm GET /manager/sellers and POST /manager/sellers return 403. Restore SELLER_READ and SELLER_CREATE afterward. Changes apply on the next authenticated request. Test a second Manager/seller pair for out-of-scope reads. Deactivate a test seller with PATCH /admin/sellers/{{sellerId}} and {"active":false}: old token and login should return 401. Reactivate with {"active":true}, then log in again. Deactivating a Manager does not automatically deactivate assigned sellers.

### Stock and financial assertions

- A receipt increases HQ and total stock by quantity.
- A transfer decreases source and increases destination equally; total stock stays unchanged.
- A confirmed sale or approved low-price sale reduces seller and total stock by quantity exactly once in a sequential manual test.
- Pending approval and rejection do not deduct stock. A low-price sale can be recorded without enough stock, but approval fails until stock is available.
- totalPaise = quantity × unitPricePaise. At incentiveRatePaise=200, incentiveAmountPaise = quantity × 200.
- Payment collection records the full amount and does not change stock. Repeat collection fails with 409.
- For an idempotency check, create a sale with a new unique requestKey, then replay the same body as the same seller. Expect 201 and the same sale ID with no second stock deduction; replay may omit nested invoice/customer/seller fields. Use a unique key per seller/test. Changing the body while reusing a key currently returns the original sale.

## Implementation details that affect testing

These describe current behavior, not stronger business guarantees:

- /categories allows any authenticated role to create/update categories. /admin/categories additionally requires SUPER_ADMIN. Do not expect 403 on Seller writes to /categories in this version.
- Only Manager seller routes currently enforce SELLER_READ and SELLER_CREATE. Manager customer, sales, inventory and dashboard routes enforce role and service-specific scope, not the other permission flags returned by /admin/permissions.
- Scope is not identical across modules. Customer list/get use Manager territory; customer create/update ownership checks do not fully enforce that same territory. Manager sales use assignment only. Manager dashboard/inventory use assignment plus state/district, not village.
- Admin dashboard filters affect sales and some entity counts differently: inventory and totalStates remain global; sellerId does not narrow totalShops and managerId does not narrow the Manager/Seller counts. Verify each metric separately.
- Payment collection checks ownership and PENDING paymentMode but currently does not require CONFIRMED sale status. Keep the normal flow on confirmed sales; record acceptance of payment on pending/rejected sales as a business-rule gap.
- requestKey lookup is global and returns an existing sale without checking seller ownership. Use unique keys; this is not a guarantee of secure cross-user idempotency.
- Stock/payment/approval checks should be tested sequentially here. This guide does not certify behavior under concurrent requests.
- Invoice endpoints return metadata. pdfPath does not imply an accessible HTTP download URL. Invoice snapshots retain original payment mode after later collection; use the current sale/payments for payment status.
- Password recovery creates reset records; production omits debugToken and no delivery integration exists. A successful production forgot-password response does not mean an email/SMS was sent.
- Sales report defaults to CONFIRMED, whereas sales-list endpoints include all statuses unless filtered. Report group totals can differ from full summary totals when row limits apply. Inventory report date ranges affect movements, while balances remain current.

## Record your test results

| Test or endpoint | Role | Actual status | Pass or fail | Actual response or issue |
| --- | --- | --- | --- | --- |
| Health and readiness | Public | | | |
| Login and role checks | All | | | |
| Manager and Seller setup | Admin/Manager | | | |
| Category and customer setup | Admin/Seller | | | |
| Receipt and transfer | Admin | | | |
| Confirmed and low-price sale | Seller | | | |
| Approve and reject | Admin | | | |
| Payment and invoice | Seller/Admin | | | |
| Dashboards and reports | All | | | |
| Validation and scope failures | All | | | |
| Password and deactivation | All | | | |

## Source and maintenance

Verified against src/app.ts, src/routes/user.routes.ts, mounted src/routes files, src/controller validators/handlers, src/services implementations, src/middleware and prisma/schema.prisma. Regenerate these two artifacts with node scripts/generate-postman-guide.mjs after updating the curated expectations in that script. The generator checks route coverage, but business-rule changes still require manual review. It does not execute requests or change database records.
`;

// Verify that every mounted business/auth route is represented (including aliases).
const mounts = [...read('src/routes/user.routes.ts').matchAll(/router\.use\("([^"]+)"[^\n]*, (create\w+Routes)\(database\)\)/g)];
const imports = Object.fromEntries([...read('src/routes/user.routes.ts').matchAll(/import \{ (create\w+Routes) \} from "\.\/([^"]+)\.js"/g)].map(m=>[m[1],m[2]+'.ts']));
const actual = ['GET /health','GET /ready'];
for (const [prefix, file] of [...mounts.map(m=>[m[1],imports[m[2]]]),['/auth','auth/auth.routes.ts']]) {
 for (const m of read('src/routes/'+file).matchAll(/(?:router|routes)\.(get|post|patch|delete|put)\("([^"]+)"/g)) actual.push(m[1].toUpperCase()+' '+prefix+(m[2]==='/'?'':m[2]));
}
const normalize = s => s.replace(/\{\{[^}]+\}\}|:[A-Za-z]+/g, ':id');
const documented = new Set(endpoints.map(e=>normalize(`${e.method} ${e.path}`)));
const missing=actual.filter(x=>!documented.has(normalize(x)));
const actualSet=new Set(actual.map(normalize));
const invented=[...documented].filter(x=>!actualSet.has(x));
if(missing.length||invented.length) throw new Error(json({missing,invented}));

const vars={baseUrl:'http://localhost:5000/api/v1',adminLogin:'',adminPassword:'',managerLogin:'qa.manager@example.com',managerPassword:'Example password 123!',sellerLogin:'qa.seller@example.com',sellerPassword:'Example password 123!',newPassword:'Replacement password 123!'};
for(const key of ['adminToken','managerToken','sellerToken','managerId','sellerId','categoryId','customerId','hqLocationId','sellerLocationId','warehouseId','saleId','pendingSaleId','rejectSaleId','invoiceId','resetToken']) vars[key]='';
const collection={info:{name:'Femmeflo Manual API Testing',description:'Current mounted API coverage. Read POSTMAN_MANUAL_TESTING.md first. Send requests individually in the documented main-flow order. Save variables manually. Examples are projections, not live responses.',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},variable:Object.entries(vars).map(([key,value])=>({key,value,type:'string'})),item:[]};
for(const e of endpoints){
 let folder=collection.item.find(f=>f.name===e.group);if(!folder){folder={name:e.group,item:[]};collection.item.push(folder);}
 const request={method:e.method,header:e.body?[{key:'Content-Type',value:'application/json'}]:[],auth:e.role==='none'?{type:'noauth'}:{type:'bearer',bearer:[{key:'token',value:v(e.role+'Token'),type:'string'}]},url:'{{baseUrl}}'+e.path,description:`Expected HTTP ${e.status}. ${e.required?'Body required fields: '+e.required+'. ':''}${e.query??''}\n${e.notes??''}\n${e.save?'Save manually: '+json(e.save):''}`,...(e.body?{body:{mode:'raw',raw:json(e.body),options:{raw:{language:'json'}}}}:{})};
 folder.item.push({name:e.title,request,event:[{listen:'test',script:{type:'text/javascript',exec:[`pm.test("Expected HTTP ${e.status}", () => pm.response.to.have.status(${e.status}));`,'pm.test("Success flag", () => pm.expect(pm.response.json().success).to.eql(true));']}}],response:[{name:'Expected key fields',originalRequest:request,status:e.status===201?'Created':'OK',code:e.status,header:[{key:'Content-Type',value:'application/json'}],body:json(e.response)}]});
}
writeFileSync(new URL('docs/POSTMAN_MANUAL_TESTING.md',root),md);
writeFileSync(new URL('docs/postman-manual-testing.postman_collection.json',root),json(collection)+'\n');
console.log(`Generated guide and collection: ${actualSet.size} mounted operations, ${endpoints.length} request examples. Route coverage complete.`);
