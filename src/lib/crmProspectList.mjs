const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('es-MX');

export function filterProspects(prospects, filters) {
  const query = normalize(filters.query);
  return prospects.filter((prospect) => {
    const matchesQuery = !query || [prospect.name, prospect.phone, prospect.property, prospect.status, prospect.seller]
      .some((value) => normalize(value).includes(query));
    const matchesStatus = filters.status === 'Todos' || prospect.status === filters.status;
    const matchesPriority = filters.priority === 'Todas' || prospect.intentionLevel === filters.priority;
    return matchesQuery && matchesStatus && matchesPriority;
  });
}

export function summarizeProspects(prospects) {
  return {
    total: prospects.length,
    highPriority: prospects.filter((prospect) => prospect.intentionLevel === 'Alta').length,
    appointments: prospects.filter((prospect) => prospect.status === 'Cita agendada').length,
    manualReview: prospects.filter((prospect) => prospect.status === 'Revisión manual').length,
    attended: prospects.filter((prospect) => prospect.status !== 'Nuevo' && prospect.status !== 'Revisión manual').length,
  };
}
