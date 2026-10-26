import { nameKey } from "./names.js";

// Correspondencia entre las personas del archivo y las del grupo, en el paso de revisión de la importación. Son funciones
// puras: la vista y las pruebas comparten el orden de las opciones, la preselección y los avisos.
export const NEW_PERSON = "new";

// Las opciones de una columna: «Soy yo» primero (si quien importa ya es una persona del grupo), luego las demás y al final
// «Una persona nueva». Se preselecciona lo que se había guardado y, si no hay nada, la persona con el mismo nombre.
export function mappingChoices({ sourceName, participants, ownId = null, saved = null }) {
  const own = participants.find(person => person.id === ownId) ?? null;
  const options = [
    ...(own ? [{ value: own.id, label: `Soy yo (${own.displayName})` }] : []),
    ...participants.filter(person => person.id !== own?.id).map(person => ({ value: person.id, label: person.displayName })),
    { value: NEW_PERSON, label: "Una persona nueva" },
  ];
  const sameName = participants.find(person => nameKey(person.displayName) === nameKey(sourceName));
  const wanted = saved ?? sameName?.id ?? NEW_PERSON;
  return { options, selected: options.some(option => option.value === wanted) ? wanted : NEW_PERSON };
}

// Avisos (no bloquean): varias columnas hacia la misma persona suman sus movimientos y saldos, y si ninguna es quien
// importa, esa persona queda fuera de los movimientos.
export function mappingWarnings({ names, mapping, participants, ownId = null }) {
  const people = new Map(participants.map(person => [person.id, person.displayName]));
  const columnsByPerson = new Map();
  mapping.forEach((choice, index) => {
    if (choice === NEW_PERSON || !people.has(choice)) return;
    columnsByPerson.set(choice, [...(columnsByPerson.get(choice) ?? []), names[index]]);
  });
  const shared = [...columnsByPerson].filter(([, columns]) => columns.length > 1).map(([personId, columns]) => ({ personId, personName: people.get(personId), columns }));
  const own = people.get(ownId) ?? null;
  return { shared, ownMissing: own !== null && !mapping.includes(ownId), ownName: own };
}
