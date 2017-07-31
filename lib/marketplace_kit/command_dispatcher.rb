module MarketplaceKit
  class CommandDispatcher
    def initialize(args)
      @args = args
    end

    def execute
      MarketplaceKit.config.load current_env
      user_authentication.authenticate

      command.new(command_args).execute
    rescue Errors::MarketplaceError => e
      puts e.message.red
    end

    private

    def command
      @command ||= case command_name
                   when 'sync'   then Commands::Sync
                   when 'deploy' then Commands::Deploy
                   when 'pull'   then Commands::Pull
                   else raise Errors::MarketplaceError.new('Usage: nearme-marketpalce sync | deploy | pull')
      end
    end

    def command_name
      @args[0]
    end

    def command_args
      @args[1..-1] || []
    end

    def current_env
      e_arg_index = command_args.find_index { |x| x == '-e' }
      return 'localhost' unless e_arg_index

      command_args[e_arg_index + 1] || 'localhost'
    end

    def user_authentication
      @user_authentication ||= Services::UserAuthentication.new
    end
  end
end
