import React from 'react';

function ServiceList({ services, actions = [], showRenewalStatus = true }) {
  const formatService = (service) => {
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
  };

  const getRenewalStatusClass = (service) => {
    if (!showRenewalStatus) return 'normal';
    if (service.isRenewingVerySoon) return 'very-soon';
    if (service.isRenewingSoon) return 'soon';
    return 'normal';
  };

  const getRenewalStatusText = (service) => {
    if (!showRenewalStatus) return '';
    if (service.daysUntilRenewal < 0) return 'Overdue';
    if (service.daysUntilRenewal === 0) return 'Today';
    if (service.daysUntilRenewal === 1) return 'Tomorrow';
    return `${service.daysUntilRenewal} days`;
  };

  return (
    <div className="service-list">
      {services.map(service => {
        const formattedService = formatService(service);
        const statusClass = getRenewalStatusClass(formattedService);
        const statusText = getRenewalStatusText(formattedService);

        return (
          <div key={service.id} className="service-item">
            <div className="service-info">
              <div className="service-name">
                {service.name}
                {service.tags && (
                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                    {service.tags}
                  </span>
                )}
              </div>
              <div className="service-details">
                {formattedService.formattedCost} • {service.frequency}
                {showRenewalStatus && (
                  <>
                    {' • '}
                    <span className={`renewal-status ${statusClass}`}>
                      {statusText}
                    </span>
                    {' • '}
                    {formattedService.formattedRenewalDate}
                  </>
                )}
              </div>
            </div>
            
            <div className="service-actions">
              {actions.map((action, index) => (
                <button
                  key={index}
                  className={action.className}
                  onClick={() => action.onClick(service.id, service)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ServiceList;