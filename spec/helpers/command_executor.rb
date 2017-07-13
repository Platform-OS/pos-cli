module Helpers
  module CommandExecutor
    def execute_command(command_line)
      args = command_line.split(' ')
      MarketplaceKit::CommandDispatcher.new(args).execute
    end
  end
end
