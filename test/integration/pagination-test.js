const nock = require('nock')

const GitHub = require('../../')

require('../mocha-node-setup')

describe('pagination', () => {
  it('.paginate()', () => {
    nock('https://pagination-test.com')
      .get('/organizations')
      .query({ page: 1, per_page: 1 })
      .reply(200, [{ id: 1 }], {
        'Link': '<https://pagination-test.com/organizations?page=2&per_page=1>; rel="next"',
        'X-GitHub-Media-Type': 'github.v3; format=json'
      })
      .get('/organizations')
      .query({ page: 2, per_page: 1 })
      .reply(200, [{ id: 2 }])
      .persist()

    const github = new GitHub({
      baseUrl: 'https://pagination-test.com'
    })

    return Promise.all([
      github.paginate('GET /organizations', { per_page: 1 })
        .then(organizations => {
          expect(organizations).to.deep.equal([
            { id: 1 },
            { id: 2 }
          ])
        }),
      github.paginate('GET /organizations', { per_page: 1 }, response => response.data.map(org => org.id))
        .then(organizations => {
          expect(organizations).to.deep.equal([1, 2])
        }),
      github.paginate({
        method: 'GET',
        url: '/organizations',
        per_page: 1
      }, response => response.data.map(org => org.id))
        .then(organizations => {
          expect(organizations).to.deep.equal([1, 2])
        })
    ])
  })

  it('autopagination', () => {
    nock('https://pagination-test.com')
      .get('/organizations')
      .query({ page: 1, per_page: 1 })
      .reply(200, [{ id: 1 }], {
        'Link': '<https://pagination-test.com/organizations?page=2&per_page=1>; rel="next"',
        'X-GitHub-Media-Type': 'github.v3; format=json'
      })
      .get('/organizations')
      .query({ page: 2, per_page: 1 })
      .reply(200, [{ id: 2 }], {
        'X-GitHub-Media-Type': 'github.v3; format=json'
      })
      .persist()

    const github = new GitHub({
      baseUrl: 'https://pagination-test.com'
    })

    github.hook.wrap('request', (request, options) => {
      if (!options.request.paginate) {
        return request(options)
      }

      delete options.request.paginate
      return github.paginate(options)
    })

    return github.request('GET /organizations', { per_page: 1, request: { paginate: true } })
      .then(organizations => {
        expect(organizations).to.deep.equal([
          { id: 1 },
          { id: 2 }
        ])
      })
  })

  it('.paginate.iterator for end endpoints that don’t paginate', () => {
    nock('https://pagination-test.com')
      .get('/orgs/myorg')
      .query({ page: 1 })
      .reply(200, {
        foo: 'bar'
      })

    const github = new GitHub({
      baseUrl: 'https://pagination-test.com'
    })

    const iterator = github.paginate.iterator({
      method: 'GET',
      url: '/orgs/:org',
      org: 'myorg'
    })[Symbol.asyncIterator]()

    return iterator.next()
      .then(result => {
        expect(result.value.data.foo).to.equal('bar')
      })
  })
})
