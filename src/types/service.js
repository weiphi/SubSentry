// Service data structure types and validation

const SERVICE_FREQUENCIES = ['monthly', 'annual'];
const SERVICE_CURRENCIES = ['USD', 'EUR'];
const SERVICE_STATUSES = ['active', 'inactive'];

class ServiceValidator {
  static validateService(serviceData) {
    const errors = [];

    if (!serviceData.name || typeof serviceData.name !== 'string') {
      errors.push('Service name is required and must be a string');
    }

    if (!serviceData.cost || typeof serviceData.cost !== 'number' || serviceData.cost <= 0) {
      errors.push('Cost is required and must be a positive number');
    }

    if (!SERVICE_CURRENCIES.includes(serviceData.currency)) {
      errors.push('Currency must be either USD or EUR');
    }

    if (!serviceData.renewalDate) {
      errors.push('Renewal date is required');
    }

    if (!SERVICE_FREQUENCIES.includes(serviceData.frequency)) {
      errors.push('Frequency must be either monthly or annual');
    }

    if (serviceData.status && !SERVICE_STATUSES.includes(serviceData.status)) {
      errors.push('Status must be either active or inactive');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static formatServiceForDisplay(service) {
    const renewalDate = new Date(service.renewal_date);
    const today = new Date();
    const timeDiff = renewalDate.getTime() - today.getTime();
    const daysUntilRenewal = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return {
      ...service,
      formattedCost: `${service.currency === 'USD' ? '$' : '€'}${service.cost.toFixed(2)}`,
      formattedRenewalDate: renewalDate.toLocaleDateString(),
      daysUntilRenewal,
      isRenewingSoon: daysUntilRenewal <= (service.frequency === 'annual' ? 30 : 3),
      isRenewingVerySoon: daysUntilRenewal <= 2
    };
  }

  static calculateNextRenewalDate(currentRenewalDate, frequency) {
    const date = new Date(currentRenewalDate);
    
    if (frequency === 'monthly') {
      date.setMonth(date.getMonth() + 1);
    } else if (frequency === 'annual') {
      date.setFullYear(date.getFullYear() + 1);
    }
    
    return date.toISOString().split('T')[0];
  }
}

module.exports = {
  SERVICE_FREQUENCIES,
  SERVICE_CURRENCIES, 
  SERVICE_STATUSES,
  ServiceValidator
};