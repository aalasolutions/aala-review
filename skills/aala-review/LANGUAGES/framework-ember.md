# Framework Overlay: EmberJS

Load this guide in addition to a base language guide:
- `./LANGUAGES/javascript.md` for `.js`
- `./LANGUAGES/typescript.md` for `.ts` in Ember projects

Apply these rules when the project is Ember-based.

---

## Architecture Rules

```
app/
  routes/          Data loading only
  controllers/     UI state only (sort, filters, modal open/close)
  services/        Business logic, API calls
  models/          Data shape (Ember Data)
  components/      Reusable UI (Glimmer syntax)
  templates/       Presentation only
```

Flag business logic in templates. Flag API calls in controllers.

## Naming

| Item | Convention | Example |
|------|-----------|---------|
| Route file | kebab-case | `user-profile.js` |
| Route class | PascalCase | `UserProfileRoute` |
| Component | kebab-case file, PascalCase class | `user-card.js`, `UserCard` |
| Model | singular | `user.js`, `payment.js` |
| Service | noun | `auth.js`, `notifications.js` |

## Routes

```javascript
// GOOD: routes load data, nothing else
import Route from '@ember/routing/route';
import { service } from '@ember/service';

export default class UsersRoute extends Route {
  @service store;

  async model() {
    return this.store.findAll('user');
  }
}

// IMPORTANT: business logic in route
export default class UsersRoute extends Route {
  async model() {
    const users = await this.store.findAll('user');
    return users.filter(u => u.isActive).sortBy('name');
  }
}
```

## Controllers

```javascript
// IMPORTANT: direct API call in controller
import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class UsersController extends Controller {
  @action
  async deleteUser(user) {
    await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    this.model.removeObject(user);
  }
}

// GOOD: delegate to service
export default class UsersController extends Controller {
  @service userService;

  @action
  async deleteUser(user) {
    await this.userService.delete(user.id);
    this.model.removeObject(user);
  }
}
```

## Components (Glimmer / Octane)

```javascript
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class UserCard extends Component {
  @tracked isExpanded = false;

  @action
  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }
}
```

Flag any use of `Ember.Object.extend()` syntax in new code. All new components must use Glimmer syntax.

## Templates (Handlebars)

```handlebars
{{! BLOCKING: triple curly renders unescaped HTML }}
{{{user.bio}}}

{{! GOOD: double curly escapes output }}
{{user.bio}}

{{! IMPORTANT: complex logic in template - extract to getter }}
{{#if (and user.isAdmin (not user.isBanned))}}
{{/if}}

{{! GOOD: logic in component getter }}
{{#if this.canShowAdminPanel}}
{{/if}}
```

## Ember Data

```javascript
// IMPORTANT: direct fetch instead of store
const users = await fetch('/api/users').then(r => r.json());

// GOOD: use the store
const users = await this.store.findAll('user');

// IMPORTANT: N+1 in route model hook
async model() {
  const orders = await this.store.findAll('order');
  for (const order of orders.toArray()) {
    await order.user;
  }
}

// GOOD: include relationships in query
async model() {
  return this.store.query('order', { include: 'user' });
}
```

## Ember Checklist

- [ ] Routes load data only (no business logic)
- [ ] Controllers hold UI state only
- [ ] No direct `fetch` in controllers: delegate to services
- [ ] Glimmer component syntax used (not `Ember.Object.extend`)
- [ ] Double curly `{{}}` in templates (not triple)
- [ ] Template logic extracted to component getters
- [ ] Ember Data `store` used for API calls
- [ ] No N+1 in route `model()` hooks
