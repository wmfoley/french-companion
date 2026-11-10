const { createHouseholdService } = require('./householdService');
const localHousehold = createHouseholdService({ supported: false });
module.exports = { localHousehold };
