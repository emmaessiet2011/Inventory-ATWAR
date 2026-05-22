const fs = require('fs');
const path = require('path');

const dashPath = path.join('src', 'components', 'dashboard', 'Dashboard.tsx');
let dashContent = fs.readFileSync(dashPath, 'utf8');

if (!dashContent.includes('isLocationAccessible')) {
  // 1. Import
  dashContent = dashContent.replace(
    `import { exportToCSV, formatDashboardDate } from '@/utils/exportUtils';`,
    `import { exportToCSV, formatDashboardDate } from '@/utils/exportUtils';\nimport { isLocationAccessible } from '@/utils/productVisibility';`
  );

  // 2. matchesLocation
  dashContent = dashContent.replace(
    `  const matchesLocation = (value?: string) => {\n    if (selectedLocationKey === 'all') return true;`,
    `  const matchesLocation = (value?: string) => {\n    if (!isLocationAccessible(value || '', currentUser, locations)) return false;\n\n    if (selectedLocationKey === 'all') return true;`
  );

  // 3. UI Dropdown
  const oldDropdown = `                <option value="all">All locations</option>
                {locations.map((location) => (`;
  const newDropdown = `                {isLocationAccessible('all', currentUser, locations) && <option value="all">All locations</option>}
                {locations.filter(loc => isLocationAccessible(loc.name, currentUser, locations) || isLocationAccessible(loc.id, currentUser, locations)).map((location) => (`;
  
  if (dashContent.includes(oldDropdown)) {
    dashContent = dashContent.replace(oldDropdown, newDropdown);
  }

  fs.writeFileSync(dashPath, dashContent);
  console.log('Patched Dashboard.tsx for LBAC');
} else {
  console.log('Dashboard.tsx already contains LBAC patches.');
}
