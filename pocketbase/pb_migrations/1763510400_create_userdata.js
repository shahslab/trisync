/// <reference path="../pb_data/types.d.ts" />

// One record per user holding everything TriSync syncs (see src/account/syncStore.js):
// { training, appearance, stravaKeys }. Only the owner can read or change it, and it is
// deleted with the account.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  const userdata = new Collection({
    type: 'base',
    name: 'userdata',
    listRule: 'user = @request.auth.id',
    viewRule: 'user = @request.auth.id',
    createRule: "@request.auth.id != '' && user = @request.auth.id",
    updateRule: 'user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: 'user = @request.auth.id',
    fields: [
      { name: 'user', type: 'relation', required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { name: 'data', type: 'json', maxSize: 5242880 },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_userdata_user ON userdata (user)'],
  })
  app.save(userdata)
}, (app) => {
  app.delete(app.findCollectionByNameOrId('userdata'))
})
