export async function audit(client, actorId, action, subjectId = null, metadata = undefined) {
  return client.auditEvent.create({
    data: {
      actorId,
      action,
      subjectId,
      ...(metadata === undefined ? {} : { metadata }),
    },
  });
}
