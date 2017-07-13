module MarketplaceKit
  class CommandDispatcher
    def initialize(args)
      @args = args
    end

    def execute
      command.new.execute
    end

    private

    def command
      @command ||= case command_name
        when "sync"   then Commands::Sync
        when "deploy" then Commands::Deploy
        else raise("Usage: nearme-marketpalce sync | deploy | pull")
      end
    end

    def command_name
      @args[0]
    end
  end
end
