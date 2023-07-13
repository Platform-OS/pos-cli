The main focus of this release is to improve on developement speed and to eliminate some of the pain points of daily development.

## Layout and design

The layout and design were completely updated but all of the old functionality should be preserved. The new looks corresponds to platformOS branding a little better and the always-present header navigation should make switching between available tools quicker without a need to get through the home screen.

The app will check if it is connected to the instance (if the `pos-cli gui serve` is running) so you won't be surprised when trying to edit something just to see nothing happening after clicking save.

New dark mode for all of you who prefer low contrast on their dev tools.


## Database management

Completely redesigned database management with table-like view:
- Filtering the tables list with keyboard navigation: type, press enter - you see the table
- Ability to toggle the tables sidebar by pressing `B`
- Filtering by ID and all of the other possible filtering operations
- Two table view modes - one with collapsed values for quick browsing and one expanded with JSON highlighting
- Ability to quickly clone a record
- A refresh button to quickly reload the data without the need to re-render the whole page (shortcut - `R`)

### Record editing improvements

- You don't have to manually use quotes when editing string, they will be added and the JSONs will be escaped automatically
- You can save and edit JSONs saved with `value_json` using a switch between `string` and `json` for `string` types
- Textareas autoresize to fit content (to an extend, they won't get super long)


## Users

- Filtering by email and ID
- Showing user details in a sidebar when clicked


## Logs

- You can now pin any log to reference it later to quickly compare before/after values and debug differences between instances
- A button to quickly copy a message without formatting
- Handling large outputs by trimming them down


## Constants

- Values hidden by default (so you won't spill secrets on screensharing)
- Filtering (although Ctrl+F worked fine in this case)



## Known issues and limitations

- The error handling and data validation is very basic
- Liquid Evaluator and GraphiQL were not updated and redirect to the old solution
- There is almost no responsiveness in the layout
- Database management lacks the tiles view that the old solution is using
- No ability to view the actual string when saving an escaped JSON using `value` (yet)
- Missing button to manually refresh logs
