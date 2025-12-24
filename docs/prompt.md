as a lead of a group that has engineers fullstack, arhitects, seniors, staff and principal you should  implemenet the first available story from  docs/stories/epic_11 file and update the file accordintly. You can implement more that one story of epic if this helps your implemetation. Also update any documentation needed
you should be critical in the implemetation. use available clis when there is the option make sure you use the latest libraries, not just what you think is the latest.
It is important to always read any refernece file that is noted in stories and keep the mase architect style
Im already runnging the servers
verify the backend with curl at least
verify the frontend with your browser
on the backend dont forget to create tests as we already do

notes

the api is prefixed with word api. for example http://localhost:4000/api/v1/markets
fix or add new seeds if needed for evaluating the story
we dont have integration tests setup. only unit for backend
the forntend is in port 3000 eg http://localhost:3000/admin

## Authentication for curl Testing

The backend uses **cookie-based session authentication** via Supabase SSR.

**Login Flow:**
```bash
# Login and save cookies
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  -c /tmp/cookies.txt

# Use cookies in subsequent requests
curl -s -X GET http://localhost:4000/api/v1/admin/markets \
  -b /tmp/cookies.txt

test user:
user@example.com
SecurePassword123!
admin user:
admin@example.com
SecurePassword123!
treasury user:
treasury@example.com
SecurePassword123!
